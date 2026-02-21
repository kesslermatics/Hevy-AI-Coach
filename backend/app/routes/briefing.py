"""
Briefing routes – serves the Daily Morning Briefing to the frontend.
"""
import logging
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models import User, MorningBriefing
from app.schemas import BriefingResponse
from app.services.aggregator import gather_user_context
from app.services.ai_service import generate_daily_briefing, generate_session_review, generate_workout_tips
from app.services.weather_service import fetch_weather
from app.services.hevy_service import fetch_workout_dates
from app.services.yazio_service import fetch_nutrition_dates
from app.encryption import decrypt_value

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/briefing", tags=["Briefing"])


async def _generate_and_save(
    user: User, db: Session, weather_data: Optional[dict] = None
) -> MorningBriefing:
    """
    Run the full pipeline: gather data → call AI → persist.
    """
    today = date.today()
    lang = user.language or "de"

    # 1) Aggregate Yazio + Hevy data
    context = await gather_user_context(user)

    # 2) Call Gemini
    briefing_data = await generate_daily_briefing(
        yazio_data=context["yazio"],
        hevy_data=context["hevy"],
        weather_data=weather_data,
        language=lang,
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
    lat: Optional[float] = Query(None),
    lon: Optional[float] = Query(None),
):
    """
    Return today's morning briefing.
    If one already exists in the DB → return it immediately.
    If not → generate on-demand (optionally with weather), save, and return.
    """
    today = date.today()

    existing = (
        db.query(MorningBriefing)
        .filter(MorningBriefing.user_id == current_user.id, MorningBriefing.date == today)
        .first()
    )
    if existing:
        return existing

    # Fetch weather if location provided
    weather_data = None
    if lat is not None and lon is not None:
        weather_data = await fetch_weather(lat, lon)

    return await _generate_and_save(current_user, db, weather_data)


@router.post("/regenerate", response_model=BriefingResponse)
async def regenerate_briefing(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    lat: Optional[float] = Query(None),
    lon: Optional[float] = Query(None),
):
    """
    Force-regenerate today's briefing (deletes the old one if present).
    """
    today = date.today()

    db.query(MorningBriefing).filter(
        MorningBriefing.user_id == current_user.id,
        MorningBriefing.date == today,
    ).delete()
    db.commit()

    weather_data = None
    if lat is not None and lon is not None:
        weather_data = await fetch_weather(lat, lon)

    return await _generate_and_save(current_user, db, weather_data)


@router.get("/weather")
async def get_weather(
    lat: float = Query(...),
    lon: float = Query(...),
    current_user: User = Depends(get_current_user),
):
    """
    Return current weather data for the user's location.
    Used by the frontend header for real-time display.
    """
    data = await fetch_weather(lat, lon)
    if not data:
        return {"temperature_c": None, "condition": "Unknown", "emoji": "🌡️"}
    return data


@router.post("/session-review")
async def get_session_review(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    On-demand session review — called when the user opens the Last Session modal.
    Makes a fresh Gemini call every time (not cached).
    Returns last_session + next_session analysis.
    """
    context = await gather_user_context(current_user)

    result = await generate_session_review(
        yazio_data=context["yazio"],
        hevy_data=context["hevy"],
        language=current_user.language or "de",
    )

    return result


@router.get("/workouts")
async def get_workout_list(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Return the user's recent workouts as a lightweight list for the picker.
    No AI involved – just fetches from Hevy.
    """
    context = await gather_user_context(current_user)
    workouts = context.get("hevy") or []

    # Return a simplified list with index, title, date, exercises, duration
    result = []
    for i, w in enumerate(workouts):
        exercise_names = [ex.get("title", "?") for ex in w.get("exercises", [])]
        result.append({
            "index": i,
            "title": w.get("title", "Workout"),
            "date": (w.get("start_time") or "")[:10],
            "duration_min": w.get("duration_min"),
            "exercise_names": exercise_names,
        })

    return result


class WorkoutTipsRequest(BaseModel):
    workout_index: int


@router.post("/workout-tips")
async def get_workout_tips(
    body: WorkoutTipsRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    On-demand workout tips — user picks a workout from the list,
    and we call Gemini to analyze it and suggest improvements.
    """
    context = await gather_user_context(current_user)
    workouts = context.get("hevy") or []

    if body.workout_index < 0 or body.workout_index >= len(workouts):
        raise HTTPException(status_code=400, detail="Invalid workout index")

    result = await generate_workout_tips(
        yazio_data=context["yazio"],
        hevy_data=workouts,
        workout_index=body.workout_index,
        language=current_user.language or "de",
    )

    return result


@router.get("/activity-heatmap")
async def get_activity_heatmap(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Return workout dates + nutrition tracking dates for a GitHub-style activity heatmap.
    Returns {workouts: [{date, title, duration_min}], nutrition: [{date, calories, protein}]}.
    """
    workout_dates: list[dict] = []
    nutrition_dates: list[dict] = []

    # Fetch workout dates from Hevy
    if current_user.hevy_api_key:
        try:
            api_key = decrypt_value(current_user.hevy_api_key)
            workout_dates = await fetch_workout_dates(api_key, max_pages=20)
        except Exception as exc:
            logger.error("Failed to fetch workout dates: %s", exc)

    # Fetch nutrition tracking dates from Yazio
    if current_user.yazio_email and current_user.yazio_password:
        try:
            email = decrypt_value(current_user.yazio_email)
            password = decrypt_value(current_user.yazio_password)
            nutrition_dates = await fetch_nutrition_dates(email, password, days=180)
        except Exception as exc:
            logger.error("Failed to fetch nutrition dates: %s", exc)

    return {
        "workouts": workout_dates,
        "nutrition": nutrition_dates,
    }
