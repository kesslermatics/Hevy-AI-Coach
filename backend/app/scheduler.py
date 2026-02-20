"""
Background scheduler – generates morning briefings for all active users at 04:00 AM.

Uses APScheduler with AsyncIOScheduler so it runs inside the same event loop
as FastAPI / uvicorn.
"""
import asyncio
import logging
from datetime import date

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models import User, MorningBriefing
from app.services.aggregator import gather_user_context
from app.services.ai_service import generate_daily_briefing

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
        briefing_data = await generate_daily_briefing(
            user_goal=user.current_goal,
            target_weight=user.target_weight,
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


def start_scheduler():
    """Start the APScheduler with the daily 04:00 AM cron job."""
    scheduler.add_job(
        daily_briefing_job,
        trigger=CronTrigger(hour=4, minute=0),
        id="daily_morning_briefing",
        name="Generate morning briefings for all users",
        replace_existing=True,
    )
    scheduler.start()
    logger.info("⏰ Scheduler started – daily briefing at 04:00 AM")


def stop_scheduler():
    """Gracefully shut down the scheduler."""
    if scheduler.running:
        scheduler.shutdown(wait=False)
        logger.info("⏰ Scheduler stopped")
