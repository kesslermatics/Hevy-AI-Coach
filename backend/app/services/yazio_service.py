"""
Yazio API service – fetches daily nutrition summaries.

Uses the undocumented Yazio v15 REST API.
Handles missing data gracefully (water, incomplete meals, etc.).
"""
import logging
from datetime import date, timedelta
from typing import Optional

import httpx

logger = logging.getLogger(__name__)

YAZIO_BASE_URL = "https://yzapi.yazio.com/v15"
YAZIO_CLIENT_ID = "1_4hiybetvfksgw40o0sog4s884kwc840wwso8go4k8c04goo4c"
YAZIO_CLIENT_SECRET = "6rok2m65xuskgkgogw40wkkk8sw0osg84s8cggsc4woos4s8o"

MEAL_KEYS = ["breakfast", "lunch", "dinner", "snack"]


async def _yazio_login(client: httpx.AsyncClient, email: str, password: str) -> Optional[str]:
    """Authenticate with Yazio and return the bearer token, or None on failure."""
    try:
        resp = await client.post(
            f"{YAZIO_BASE_URL}/oauth/token",
            json={
                "client_id": YAZIO_CLIENT_ID,
                "client_secret": YAZIO_CLIENT_SECRET,
                "username": email,
                "password": password,
                "grant_type": "password",
            },
        )
        if resp.status_code != 200:
            logger.warning("Yazio login failed (HTTP %s): %s", resp.status_code, resp.text[:200])
            return None
        return resp.json().get("access_token")
    except Exception as exc:
        logger.error("Yazio login error: %s", exc)
        return None


async def _fetch_daily_summary(client: httpx.AsyncClient, token: str, target_date: str) -> Optional[dict]:
    """Fetch the Yazio daily-summary widget for a given date string (YYYY-MM-DD)."""
    try:
        resp = await client.get(
            f"{YAZIO_BASE_URL}/user/widgets/daily-summary",
            headers={"Authorization": f"Bearer {token}", "Accept": "application/json"},
            params={"date": target_date},
        )
        if resp.status_code != 200:
            logger.warning("Yazio daily-summary failed (HTTP %s)", resp.status_code)
            return None
        return resp.json()
    except Exception as exc:
        logger.error("Yazio daily-summary error: %s", exc)
        return None


def _parse_summary(raw: dict) -> dict:
    """
    Normalise a Yazio daily-summary into a clean dict.

    Handles missing meals/nutrients gracefully — if a key doesn't exist
    we just default to 0 instead of crashing.
    """
    meals = raw.get("meals", {})
    goals = raw.get("goals", {})
    user_info = raw.get("user", {})

    parsed_meals: dict[str, dict] = {}
    totals = {"calories": 0.0, "protein": 0.0, "carbs": 0.0, "fat": 0.0}

    for key in MEAL_KEYS:
        nutrients = meals.get(key, {}).get("nutrients", {})
        cal  = nutrients.get("energy.energy", 0)
        prot = nutrients.get("nutrient.protein", 0)
        carb = nutrients.get("nutrient.carb", 0)
        fat  = nutrients.get("nutrient.fat", 0)

        parsed_meals[key] = {
            "calories": round(cal, 1),
            "protein":  round(prot, 1),
            "carbs":    round(carb, 1),
            "fat":      round(fat, 1),
        }
        totals["calories"] += cal
        totals["protein"]  += prot
        totals["carbs"]    += carb
        totals["fat"]      += fat

    # Round totals
    totals = {k: round(v, 1) for k, v in totals.items()}

    goal_data = {
        "calories": round(goals.get("energy.energy", 0), 1),
        "protein":  round(goals.get("nutrient.protein", 0), 1),
        "carbs":    round(goals.get("nutrient.carb", 0), 1),
        "fat":      round(goals.get("nutrient.fat", 0), 1),
    }

    # Water – might simply be missing
    water_ml = raw.get("consumed_water", 0) or 0
    water_goal_ml = raw.get("water_goal", 0) or 0

    # Steps / activity – also optional
    steps = raw.get("steps", 0) or 0
    activity_kcal = raw.get("activity_energy", 0) or 0

    return {
        "meals": parsed_meals,
        "totals": totals,
        "goals": goal_data,
        "water_ml": water_ml,
        "water_goal_ml": water_goal_ml,
        "steps": steps,
        "activity_kcal": round(activity_kcal, 1),
        "user_goal": user_info.get("goal", ""),
        "current_weight": user_info.get("current_weight"),
    }


async def fetch_yazio_summary(email: str, password: str, target_date: Optional[date] = None) -> Optional[dict]:
    """
    High-level function: login → fetch yesterday's summary → parse.

    Returns a clean dict or None if anything goes wrong.
    """
    if target_date is None:
        target_date = date.today() - timedelta(days=1)

    date_str = target_date.isoformat()

    async with httpx.AsyncClient(timeout=30.0) as client:
        token = await _yazio_login(client, email, password)
        if not token:
            return None

        raw = await _fetch_daily_summary(client, token, date_str)
        if not raw:
            return None

    return _parse_summary(raw)
