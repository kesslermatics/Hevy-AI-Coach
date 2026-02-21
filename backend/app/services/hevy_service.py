"""
Hevy API service – fetches recent workouts.

Uses the official Hevy v1 REST API.
Docs: https://api.hevyapp.com/docs
"""
import logging
from datetime import datetime
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


async def fetch_workout_dates(api_key: str, max_pages: int = 10) -> list[dict]:
    """
    Fetch all workout dates (lightweight – no exercise details).
    Returns a list of {date: "YYYY-MM-DD", title: str, duration_min: int|None}.
    Used for the GitHub-style activity heatmap.
    """
    headers = {"api-key": api_key, "Accept": "application/json"}

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            all_dates: list[dict] = []
            page = 1

            while page <= max_pages:
                resp = await client.get(
                    f"{HEVY_BASE_URL}/workouts",
                    headers=headers,
                    params={"page": page, "pageSize": 10},
                )

                if resp.status_code != 200:
                    break

                data = resp.json()
                raw_workouts = data.get("workouts", data.get("data", []))

                if not raw_workouts:
                    break

                for w in raw_workouts:
                    start_time = w.get("start_time", "")
                    workout_date = start_time[:10] if start_time else None
                    if workout_date:
                        # Calculate duration
                        end_time = w.get("end_time", "")
                        duration_min = None
                        if start_time and end_time:
                            try:
                                fmt = "%Y-%m-%dT%H:%M:%SZ"
                                s = start_time.replace("+00:00", "Z").rstrip("Z") + "Z"
                                e = end_time.replace("+00:00", "Z").rstrip("Z") + "Z"
                                dt_s = datetime.strptime(s, fmt)
                                dt_e = datetime.strptime(e, fmt)
                                duration_min = round((dt_e - dt_s).total_seconds() / 60)
                            except Exception:
                                pass

                        all_dates.append({
                            "date": workout_date,
                            "title": w.get("title", "Workout"),
                            "duration_min": duration_min,
                        })

                if len(raw_workouts) < 10:
                    break
                page += 1

            return all_dates

    except Exception as exc:
        logger.error("Hevy API error (workout dates): %s", exc)
        return []
