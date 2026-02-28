"""
Data aggregation service – gathers Yazio + Hevy data for a user.

Orchestrates the individual API services and handles missing data.
"""
import logging
from datetime import date
from typing import Optional

from sqlalchemy.orm import Session

from app.models import User
from app.encryption import decrypt_value
from app.services.yazio_service import fetch_yazio_summary
from app.services.hevy_service import fetch_recent_workouts

logger = logging.getLogger(__name__)


async def gather_user_context(user: User, include_today_nutrition: bool = True) -> dict:
    """
    Fetch yesterday's Yazio nutrition + today's live nutrition + last 20 Hevy workouts.

    Returns:
        {
            "yazio": { ... } | None,           # yesterday's data
            "yazio_today": { ... } | None,     # today's live nutrition
            "hevy":  [ ... ] | None,
        }
    """
    yazio_data: Optional[dict] = None
    yazio_today: Optional[dict] = None
    hevy_data: Optional[list] = None

    # ── Yazio ────────────────────────────────────────────
    if user.yazio_email and user.yazio_password:
        try:
            email = decrypt_value(user.yazio_email)
            password = decrypt_value(user.yazio_password)
            yazio_data = await fetch_yazio_summary(email, password)  # yesterday by default
            if include_today_nutrition:
                yazio_today = await fetch_yazio_summary(email, password, target_date=date.today())
        except Exception as exc:
            logger.error("Failed to gather Yazio data for user %s: %s", user.id, exc)
    else:
        logger.info("User %s has no Yazio credentials – skipping nutrition", user.id)

    # ── Hevy ─────────────────────────────────────────────
    if user.hevy_api_key:
        try:
            api_key = decrypt_value(user.hevy_api_key)
            hevy_data = await fetch_recent_workouts(api_key, count=20)
        except Exception as exc:
            logger.error("Failed to gather Hevy data for user %s: %s", user.id, exc)
    else:
        logger.info("User %s has no Hevy API key – skipping workouts", user.id)

    return {
        "yazio": yazio_data,
        "yazio_today": yazio_today,
        "hevy": hevy_data,
    }
