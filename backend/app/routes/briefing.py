"""
Briefing routes – serves the Daily Morning Briefing to the frontend.
"""
import logging
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models import User, MorningBriefing
from app.schemas import BriefingResponse
from app.services.aggregator import gather_user_context
from app.services.ai_service import generate_daily_briefing, generate_session_review

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/briefing", tags=["Briefing"])


async def _generate_and_save(user: User, db: Session) -> MorningBriefing:
    """
    Run the full pipeline: gather data → call AI → persist.

    Raises HTTPException on total failure.
    """
    today = date.today()

    # 1) Aggregate Yazio + Hevy data
    context = await gather_user_context(user)

    # 2) Call Gemini
    briefing_data = await generate_daily_briefing(
        yazio_data=context["yazio"],
        hevy_data=context["hevy"],
    )

    # 3) Persist
    briefing = MorningBriefing(
        user_id=user.id,
        date=today,
        briefing_data=briefing_data,
    )
    db.add(briefing)
    try:
        db.commit()
        db.refresh(briefing)
    except Exception:
        db.rollback()
        # Could be a unique constraint race – try fetching again
        existing = (
            db.query(MorningBriefing)
            .filter(MorningBriefing.user_id == user.id, MorningBriefing.date == today)
            .first()
        )
        if existing:
            return existing
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to save briefing",
        )

    logger.info("Briefing generated for user %s on %s", user.id, today)
    return briefing


@router.get("/today", response_model=BriefingResponse)
async def get_todays_briefing(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Return today's morning briefing.

    - If one already exists in the DB → return it immediately.
    - If not → generate on-demand, save, and return.
    """
    today = date.today()

    # Try cached first
    existing = (
        db.query(MorningBriefing)
        .filter(MorningBriefing.user_id == current_user.id, MorningBriefing.date == today)
        .first()
    )
    if existing:
        return existing

    # On-demand generation
    return await _generate_and_save(current_user, db)


@router.post("/regenerate", response_model=BriefingResponse)
async def regenerate_briefing(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Force-regenerate today's briefing (deletes the old one if present).
    Useful when the user has updated their tracking after the 4 AM cron ran.
    """
    today = date.today()

    # Delete existing
    db.query(MorningBriefing).filter(
        MorningBriefing.user_id == current_user.id,
        MorningBriefing.date == today,
    ).delete()
    db.commit()

    return await _generate_and_save(current_user, db)


@router.post("/session-review")
async def get_session_review(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    On-demand session review — called when the user opens the modal.
    Makes a fresh Gemini call every time (not cached).
    Returns last_session + next_session analysis.
    """
    context = await gather_user_context(current_user)

    result = await generate_session_review(
        yazio_data=context["yazio"],
        hevy_data=context["hevy"],
    )

    return result
