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


async def _fetch_consumed_items(client: httpx.AsyncClient, token: str, target_date: str) -> Optional[list]:
    """
    Fetch individual consumed food items for a date.
    These contain full nutrient breakdowns (sugar, fiber, saturated fat, sodium, etc.)
    unlike the daily-summary widget which only has the 4 basics.
    """
    headers = {"Authorization": f"Bearer {token}", "Accept": "application/json"}

    # Try multiple possible endpoints for consumed items
    endpoints = [
        f"{YAZIO_BASE_URL}/user/consumed",
        f"{YAZIO_BASE_URL}/user/tracker/consumed",
        f"{YAZIO_BASE_URL}/user/diary/consumed",
        f"{YAZIO_BASE_URL}/user/food-diary",
        f"{YAZIO_BASE_URL}/user/diary",
    ]

    for endpoint in endpoints:
        try:
            resp = await client.get(endpoint, headers=headers, params={"date": target_date})
            logger.info("Yazio probe %s → HTTP %s (size: %d bytes)",
                        endpoint.split("/v15/")[-1], resp.status_code, len(resp.content))
            if resp.status_code == 200:
                data = resp.json()
                # Log a sample of the response structure
                if isinstance(data, list) and len(data) > 0:
                    sample = data[0]
                    logger.info("Yazio consumed item sample keys: %s", list(sample.keys()) if isinstance(sample, dict) else type(sample))
                    if isinstance(sample, dict) and "nutrients" in sample:
                        logger.info("Yazio consumed item nutrient keys: %s", list(sample["nutrients"].keys()))
                    return data
                elif isinstance(data, dict):
                    logger.info("Yazio consumed response keys: %s", list(data.keys()))
                    # Could be wrapped in a container
                    items = data.get("items") or data.get("consumed") or data.get("entries") or data.get("data")
                    if isinstance(items, list) and len(items) > 0:
                        sample = items[0]
                        logger.info("Yazio consumed nested item keys: %s", list(sample.keys()) if isinstance(sample, dict) else type(sample))
                        if isinstance(sample, dict) and "nutrients" in sample:
                            logger.info("Yazio consumed nested nutrient keys: %s", list(sample["nutrients"].keys()))
                        return items
        except Exception as exc:
            logger.debug("Yazio probe %s failed: %s", endpoint, exc)

    return None


async def _fetch_user_profile(client: httpx.AsyncClient, token: str) -> Optional[dict]:
    """Fetch the full Yazio user profile (/v15/user)."""
    try:
        resp = await client.get(
            f"{YAZIO_BASE_URL}/user",
            headers={"Authorization": f"Bearer {token}", "Accept": "application/json"},
        )
        if resp.status_code != 200:
            logger.warning("Yazio user profile failed (HTTP %s)", resp.status_code)
            return None
        return resp.json()
    except Exception as exc:
        logger.error("Yazio user profile error: %s", exc)
        return None


def _parse_profile(raw: dict, summary_user: dict) -> dict:
    """
    Extract relevant user profile data from the /user endpoint
    and the daily-summary 'user' field.
    """
    diet = raw.get("diet", {})
    return {
        "first_name": raw.get("first_name", ""),
        "last_name": raw.get("last_name", ""),
        "sex": raw.get("sex", ""),
        "date_of_birth": raw.get("date_of_birth", ""),
        "body_height_cm": raw.get("body_height"),
        "current_weight_kg": summary_user.get("current_weight"),
        "start_weight_kg": summary_user.get("start_weight") or raw.get("start_weight"),
        "goal": summary_user.get("goal") or raw.get("goal", ""),
        "activity_degree": raw.get("activity_degree", ""),
        "weight_change_per_week_kg": raw.get("weight_change_per_week"),
        "diet_name": diet.get("name", ""),
        "diet_carb_pct": diet.get("carb_percentage"),
        "diet_fat_pct": diet.get("fat_percentage"),
        "diet_protein_pct": diet.get("protein_percentage"),
    }


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
    totals = {
        "calories": 0.0, "protein": 0.0, "carbs": 0.0, "fat": 0.0,
        "sugar": 0.0, "fiber": 0.0, "saturated_fat": 0.0, "sodium": 0.0,
    }

    _logged_keys = False
    for key in MEAL_KEYS:
        nutrients = meals.get(key, {}).get("nutrients", {})

        # Log ALL nutrient keys + values for every meal so we can find the right keys
        if nutrients:
            logger.info("Yazio RAW nutrients for '%s': %s", key,
                        {k: round(v, 2) if isinstance(v, (int, float)) else v for k, v in nutrients.items()})
            if not _logged_keys:
                _logged_keys = True

        cal  = nutrients.get("energy.energy", 0)
        prot = nutrients.get("nutrient.protein", 0)
        carb = nutrients.get("nutrient.carb", 0)
        fat  = nutrients.get("nutrient.fat", 0)
        sugar = nutrients.get("nutrient.sugar", 0)
        fiber = nutrients.get("nutrient.fiber", 0)
        sat_fat = nutrients.get("nutrient.saturated_fat", 0)
        sodium = nutrients.get("nutrient.sodium", 0)

        parsed_meals[key] = {
            "calories": round(cal, 1),
            "protein":  round(prot, 1),
            "carbs":    round(carb, 1),
            "fat":      round(fat, 1),
            "sugar":    round(sugar, 1),
            "fiber":    round(fiber, 1),
            "saturated_fat": round(sat_fat, 1),
            "sodium":   round(sodium, 1),
        }
        totals["calories"] += cal
        totals["protein"]  += prot
        totals["carbs"]    += carb
        totals["fat"]      += fat
        totals["sugar"]    += sugar
        totals["fiber"]    += fiber
        totals["saturated_fat"] += sat_fat
        totals["sodium"]   += sodium

    # Round totals
    totals = {k: round(v, 1) for k, v in totals.items()}

    goal_data = {
        "calories": round(goals.get("energy.energy", 0), 1),
        "protein":  round(goals.get("nutrient.protein", 0), 1),
        "carbs":    round(goals.get("nutrient.carb", 0), 1),
        "fat":      round(goals.get("nutrient.fat", 0), 1),
        "sugar":    round(goals.get("nutrient.sugar", 0), 1),
        "fiber":    round(goals.get("nutrient.fiber", 0), 1),
        "saturated_fat": round(goals.get("nutrient.saturated_fat", 0), 1),
        "sodium":   round(goals.get("nutrient.sodium", 0), 1),
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
    }


async def fetch_yazio_summary(email: str, password: str, target_date: Optional[date] = None) -> Optional[dict]:
    """
    High-level function: login → fetch yesterday's summary + user profile → parse.

    Returns a dict with keys: meals, totals, goals, water_ml, steps, activity_kcal, profile.
    Returns None if anything goes wrong.
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

        # Fetch full user profile for name, height, goal, diet etc.
        raw_profile = await _fetch_user_profile(client, token)

        # Probe consumed-items endpoints for detailed nutrients (sugar, fiber, etc.)
        consumed_items = await _fetch_consumed_items(client, token, date_str)

    result = _parse_summary(raw)

    # Merge profile data
    summary_user = raw.get("user", {})
    if raw_profile:
        result["profile"] = _parse_profile(raw_profile, summary_user)
    else:
        # Fallback: use whatever the daily-summary 'user' field has
        result["profile"] = {
            "first_name": "",
            "last_name": "",
            "sex": summary_user.get("sex", ""),
            "date_of_birth": "",
            "body_height_cm": None,
            "current_weight_kg": summary_user.get("current_weight"),
            "start_weight_kg": summary_user.get("start_weight"),
            "goal": summary_user.get("goal", ""),
            "activity_degree": "",
            "weight_change_per_week_kg": None,
            "diet_name": "",
            "diet_carb_pct": None,
            "diet_fat_pct": None,
            "diet_protein_pct": None,
        }

    return result


async def fetch_nutrition_dates(
    email: str, password: str, days: int = 180
) -> list[dict]:
    """
    Check which dates have tracked nutrition over the last `days` days.
    Returns a list of {date: "YYYY-MM-DD", calories: float, protein: float}.
    Used for the GitHub-style activity heatmap.
    """
    import asyncio

    async with httpx.AsyncClient(timeout=30.0) as client:
        token = await _yazio_login(client, email, password)
        if not token:
            return []

        tracked: list[dict] = []
        today = date.today()

        # Fetch in batches to avoid hammering the API
        # Check each day — but limit concurrency
        semaphore = asyncio.Semaphore(5)

        async def check_date(d: date) -> Optional[dict]:
            async with semaphore:
                try:
                    resp = await client.get(
                        f"{YAZIO_BASE_URL}/user/widgets/daily-summary",
                        headers={"Authorization": f"Bearer {token}", "Accept": "application/json"},
                        params={"date": d.isoformat()},
                    )
                    if resp.status_code != 200:
                        return None
                    data = resp.json()
                    meals = data.get("meals", {})
                    total_cal = 0.0
                    total_protein = 0.0
                    for key in MEAL_KEYS:
                        nutrients = meals.get(key, {}).get("nutrients", {})
                        total_cal += nutrients.get("energy.energy", 0)
                        total_protein += nutrients.get("nutrient.protein", 0)
                    # Only count as tracked if any calories were logged
                    if total_cal > 0:
                        return {
                            "date": d.isoformat(),
                            "calories": round(total_cal, 1),
                            "protein": round(total_protein, 1),
                        }
                    return None
                except Exception:
                    return None

        dates_to_check = [today - timedelta(days=i) for i in range(days)]
        results = await asyncio.gather(*[check_date(d) for d in dates_to_check])

        tracked = [r for r in results if r is not None]
        return tracked
