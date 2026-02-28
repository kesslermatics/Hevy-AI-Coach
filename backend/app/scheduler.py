"""
Background scheduler – generates morning briefings for all active users at 04:00 AM
and checks for new Hevy workouts every hour to auto-generate session reviews.

Uses APScheduler with AsyncIOScheduler so it runs inside the same event loop
as FastAPI / uvicorn.
"""
import asyncio
import logging
from datetime import date, datetime

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models import User, MorningBriefing, WorkoutReview, WeightEntry
from app.services.aggregator import gather_user_context
from app.services.ai_service import generate_daily_briefing, generate_session_review, generate_workout_tips

logger = logging.getLogger(__name__)

scheduler = AsyncIOScheduler()


async def _generate_for_user(user: User, db: Session) -> bool:
    """Generate and save a briefing for one user. Returns True on success."""
    today = date.today()

    # Skip if already generated
    existing = (
        db.query(MorningBriefing)
        .filter(MorningBriefing.user_id == user.id, MorningBriefing.date == today)
        .first()
    )
    if existing:
        logger.debug("Briefing already exists for user %s on %s – skipping", user.username, today)
        return True

    try:
        context = await gather_user_context(user)

        # Log weight from Yazio
        yazio = context.get("yazio")
        if yazio and yazio.get("profile"):
            weight = yazio["profile"].get("current_weight_kg")
            if weight and weight > 0:
                existing_w = (
                    db.query(WeightEntry)
                    .filter(WeightEntry.user_id == user.id, WeightEntry.date == today)
                    .first()
                )
                if not existing_w:
                    db.add(WeightEntry(user_id=user.id, date=today, weight_kg=round(weight, 2)))
                    try:
                        db.commit()
                    except Exception:
                        db.rollback()

        briefing_data = await generate_daily_briefing(
            yazio_data=context["yazio"],
            hevy_data=context["hevy"],
        )

        briefing = MorningBriefing(
            user_id=user.id,
            date=today,
            briefing_data=briefing_data,
        )
        db.add(briefing)
        db.commit()
        logger.info("✅ Briefing generated for %s", user.username)
        return True

    except Exception as exc:
        db.rollback()
        logger.error("❌ Failed to generate briefing for %s: %s", user.username, exc)
        return False


async def _generate_workout_review_for_user(user: User, db: Session, max_new_reviews: int = 3) -> int:
    """
    Check for new Hevy workouts and generate AI reviews for any that don't have one yet.
    Also looks up the last review for the same workout name to provide coaching memory.
    Returns the number of new reviews generated.

    Args:
        max_new_reviews: Maximum number of NEW reviews to generate in one run.
                         Scheduler uses 3 (conservative), manual trigger uses 5.
                         Already-reviewed workouts are always skipped (zero tokens).
    """
    from app.encryption import decrypt_value
    from app.services.hevy_service import fetch_recent_workouts

    if not user.hevy_api_key:
        return 0

    try:
        api_key = decrypt_value(user.hevy_api_key)
        workouts = await fetch_recent_workouts(api_key, count=20)
    except Exception as exc:
        logger.error("Failed to fetch Hevy workouts for %s: %s", user.username, exc)
        return 0

    if not workouts:
        return 0

    generated = 0

    for i, workout in enumerate(workouts):
        hevy_id = workout.get("id", "")
        if not hevy_id:
            continue

        # Check if we already reviewed this workout — NEVER regenerate
        existing = (
            db.query(WorkoutReview)
            .filter(WorkoutReview.user_id == user.id, WorkoutReview.hevy_workout_id == str(hevy_id))
            .first()
        )
        if existing:
            continue

        # Cap how many NEW reviews we generate per run to control token spend
        if generated >= max_new_reviews:
            break

        workout_name = workout.get("title", "Workout")
        workout_start = workout.get("start_time", "")

        # Parse workout date
        try:
            workout_dt = datetime.fromisoformat(workout_start.replace("Z", "+00:00"))
        except Exception:
            workout_dt = datetime.utcnow()

        # ── Coach Memory: Find the last 3 reviews for the same workout name ──
        previous_reviews = (
            db.query(WorkoutReview)
            .filter(
                WorkoutReview.user_id == user.id,
                WorkoutReview.workout_name == workout_name,
            )
            .order_by(WorkoutReview.workout_date.desc())
            .limit(3)
            .all()
        )
        previous_tips_list = [r.tips_data for r in previous_reviews if r.tips_data]
        previous_review_list = [r.review_data for r in previous_reviews if r.review_data]

        try:
            # Gather full context (nutrition + workouts)
            context = await gather_user_context(user)
            lang = user.language or "de"

            # Generate session review (with coaching memory — last 3)
            review_data = await generate_session_review(
                yazio_data=context["yazio"],
                hevy_data=context["hevy"],
                language=lang,
                previous_reviews=previous_review_list,
            )

            # Generate workout tips (with coaching memory — last 3)
            tips_data = await generate_workout_tips(
                yazio_data=context["yazio"],
                hevy_data=workouts,
                workout_index=i,
                language=lang,
                previous_tips_list=previous_tips_list,
            )

            # Save to DB
            review = WorkoutReview(
                user_id=user.id,
                hevy_workout_id=str(hevy_id),
                workout_name=workout_name,
                workout_date=workout_dt,
                review_data=review_data,
                tips_data=tips_data,
                is_read=False,
            )
            db.add(review)
            db.commit()
            generated += 1
            logger.info("✅ Workout review generated for %s — %s (%s)", user.username, workout_name, hevy_id)

        except Exception as exc:
            db.rollback()
            logger.error("❌ Failed to generate workout review for %s workout %s: %s", user.username, hevy_id, exc)

        # Small delay between AI calls to avoid rate-limits
        await asyncio.sleep(2)

    return generated


async def daily_briefing_job():
    """
    Cron job entry point – iterates all users with active credentials
    and generates their morning briefings.
    """
    logger.info("🌅 Starting daily briefing generation…")

    db: Session = SessionLocal()
    try:
        # Find all users who have BOTH Hevy + Yazio credentials
        active_users = (
            db.query(User)
            .filter(
                User.hevy_api_key.isnot(None),
                User.yazio_email.isnot(None),
                User.yazio_password.isnot(None),
            )
            .all()
        )

        logger.info("Found %d active users", len(active_users))

        success = 0
        for user in active_users:
            if await _generate_for_user(user, db):
                success += 1
            # Small delay between users to avoid rate-limits
            await asyncio.sleep(1)

        logger.info("🌅 Briefing generation complete: %d/%d succeeded", success, len(active_users))

    except Exception as exc:
        logger.error("Briefing cron job crashed: %s", exc)
    finally:
        db.close()


async def workout_review_job():
    """
    Hourly job – checks all active users for new Hevy workouts
    and auto-generates AI session reviews + tips in the background.
    """
    logger.info("🏋️ Starting workout review check…")

    db: Session = SessionLocal()
    try:
        active_users = (
            db.query(User)
            .filter(User.hevy_api_key.isnot(None))
            .all()
        )

        logger.info("Found %d users with Hevy keys", len(active_users))

        total_generated = 0
        for user in active_users:
            n = await _generate_workout_review_for_user(user, db)
            total_generated += n
            if n > 0:
                await asyncio.sleep(2)

        logger.info("🏋️ Workout review check complete: %d new reviews generated", total_generated)

    except Exception as exc:
        logger.error("Workout review cron job crashed: %s", exc)
    finally:
        db.close()


def start_scheduler():
    """Start the APScheduler with the daily 04:00 AM cron job and hourly workout review job."""
    scheduler.add_job(
        daily_briefing_job,
        trigger=CronTrigger(hour=4, minute=0),
        id="daily_morning_briefing",
        name="Generate morning briefings for all users",
        replace_existing=True,
    )
    scheduler.add_job(
        workout_review_job,
        trigger=IntervalTrigger(hours=1),
        id="hourly_workout_review",
        name="Check for new workouts and generate reviews",
        replace_existing=True,
    )
    scheduler.start()
    logger.info("⏰ Scheduler started – daily briefing at 04:00 AM + workout reviews every hour")


def stop_scheduler():
    """Gracefully shut down the scheduler."""
    if scheduler.running:
        scheduler.shutdown(wait=False)
        logger.info("⏰ Scheduler stopped")
