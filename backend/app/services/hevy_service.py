"""
Hevy API service – fetches recent workouts.

Uses the official Hevy v1 REST API.
Docs: https://api.hevyapp.com/docs
"""
import logging
from typing import Optional

import httpx

logger = logging.getLogger(__name__)

HEVY_BASE_URL = "https://api.hevyapp.com/v1"


async def fetch_recent_workouts(api_key: str, count: int = 5) -> Optional[list[dict]]:
    """
    Fetch the last *count* completed workouts from the Hevy API.

    Returns a list of simplified workout dicts, or None on failure.
    Each workout dict contains:
      - title, start_time, end_time, duration_min
      - exercises: list of {title, muscle_group, sets: [{weight_kg, reps, …}]}
    """
    headers = {"api-key": api_key, "Accept": "application/json"}

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            all_workouts: list[dict] = []
            page = 1
            page_size = min(count, 10)

            while len(all_workouts) < count:
                resp = await client.get(
                    f"{HEVY_BASE_URL}/workouts",
                    headers=headers,
                    params={"page": page, "pageSize": page_size},
                )

                if resp.status_code == 401:
                    logger.warning("Hevy API key is invalid or expired")
                    return None
                if resp.status_code != 200:
                    logger.warning("Hevy workouts failed (HTTP %s): %s", resp.status_code, resp.text[:300])
                    return None

                data = resp.json()
                raw_workouts = data.get("workouts", data.get("data", []))

                if not raw_workouts:
                    break

                all_workouts.extend([_simplify_workout(w) for w in raw_workouts])
                page += 1

                # If we got fewer than requested, there are no more
                if len(raw_workouts) < page_size:
                    break

            if not all_workouts:
                logger.info("No workouts returned from Hevy")
                return []

            return all_workouts[:count]

    except Exception as exc:
        logger.error("Hevy API error: %s", exc)
        return None


def _simplify_workout(w: dict) -> dict:
    """
    Condense a raw Hevy workout payload into the fields the AI needs.
    Gracefully handles missing keys.
    """
    exercises: list[dict] = []
    for ex in w.get("exercises", []):
        sets_data: list[dict] = []
        for s in ex.get("sets", []):
            sets_data.append({
                "weight_kg": s.get("weight_kg"),
                "reps": s.get("reps"),
                "distance_meters": s.get("distance_meters"),
                "duration_seconds": s.get("duration_seconds"),
                "type": s.get("type", "normal"),
            })
        exercises.append({
            "title": ex.get("title", "Unknown Exercise"),
            "muscle_group": ex.get("muscle_group", ""),
            "superset_id": ex.get("superset_id"),
            "sets": sets_data,
        })

    # Duration in minutes
    start = w.get("start_time", "")
    end = w.get("end_time", "")
    duration_min = None
    if start and end:
        try:
            from datetime import datetime
            fmt = "%Y-%m-%dT%H:%M:%SZ"
            # Try parsing with Z suffix, fallback to +00:00
            s = start.replace("+00:00", "Z").rstrip("Z") + "Z"
            e = end.replace("+00:00", "Z").rstrip("Z") + "Z"
            dt_start = datetime.strptime(s, fmt)
            dt_end = datetime.strptime(e, fmt)
            duration_min = round((dt_end - dt_start).total_seconds() / 60)
        except Exception:
            pass

    return {
        "title": w.get("title", "Workout"),
        "start_time": start,
        "end_time": end,
        "duration_min": duration_min,
        "exercises": exercises,
    }
