"""
Analytics service — computes macro-performance correlations, streaks,
weekly/monthly reports, achievements, and progressive overload data.

All computation happens on raw Hevy + Yazio data (no AI calls).
"""
import logging
from collections import defaultdict
from datetime import date, datetime, timedelta
from typing import Optional

logger = logging.getLogger(__name__)


# ════════════════════════════════════════════════════════
#  MACRO-PERFORMANCE CORRELATION
# ════════════════════════════════════════════════════════

def _extract_workout_date(workout: dict) -> Optional[str]:
    """Extract YYYY-MM-DD from a workout's start_time."""
    st = workout.get("start_time", "")
    return st[:10] if st and len(st) >= 10 else None


def _compute_workout_metrics(workout: dict) -> dict:
    """Compute total volume and best e1RM per workout."""
    total_volume = 0.0
    best_e1rm = 0.0
    exercise_count = 0

    for ex in workout.get("exercises", []):
        exercise_count += 1
        for s in ex.get("sets", []):
            w = s.get("weight_kg") or 0
            r = s.get("reps") or 0
            if w > 0 and r > 0:
                total_volume += w * r
                e1rm = w * (1 + r / 30.0)
                if e1rm > best_e1rm:
                    best_e1rm = e1rm

    return {
        "title": workout.get("title", "Workout"),
        "date": _extract_workout_date(workout),
        "total_volume_kg": round(total_volume, 1),
        "best_e1rm": round(best_e1rm, 1),
        "exercise_count": exercise_count,
        "duration_min": workout.get("duration_min"),
    }


def compute_macro_performance_correlation(
    workouts: list[dict],
    nutrition_by_date: dict,
) -> dict:
    """
    Correlate nutrition data from the day before each workout with performance.

    nutrition_by_date: {date_str: {calories, protein, carbs, fat, goals: {...}}}
    Returns correlation insights.
    """
    data_points = []

    for w in workouts:
        metrics = _compute_workout_metrics(w)
        workout_date = metrics["date"]
        if not workout_date:
            continue

        # Get previous day's nutrition
        try:
            wd = datetime.strptime(workout_date, "%Y-%m-%d").date()
            prev_day = (wd - timedelta(days=1)).isoformat()
        except Exception:
            continue

        nutrition = nutrition_by_date.get(prev_day)
        if not nutrition:
            continue

        data_points.append({
            "workout_date": workout_date,
            "workout_title": metrics["title"],
            "volume": metrics["total_volume_kg"],
            "best_e1rm": metrics["best_e1rm"],
            "duration_min": metrics["duration_min"],
            "prev_day_calories": nutrition.get("calories", 0),
            "prev_day_protein": nutrition.get("protein", 0),
            "prev_day_carbs": nutrition.get("carbs", 0),
            "prev_day_fat": nutrition.get("fat", 0),
            "calorie_goal": nutrition.get("goals", {}).get("calories", 0),
            "protein_goal": nutrition.get("goals", {}).get("protein", 0),
        })

    if len(data_points) < 2:
        return {
            "data_points": data_points,
            "insights": [],
            "has_enough_data": False,
            "total_correlated_workouts": len(data_points),
        }

    # Compute insights
    insights = []

    # Average volume & e1rm split by high/low carbs
    avg_carbs = sum(d["prev_day_carbs"] for d in data_points) / len(data_points)
    high_carb_sessions = [d for d in data_points if d["prev_day_carbs"] > avg_carbs]
    low_carb_sessions = [d for d in data_points if d["prev_day_carbs"] <= avg_carbs]

    if high_carb_sessions and low_carb_sessions:
        avg_vol_high = sum(d["volume"] for d in high_carb_sessions) / len(high_carb_sessions)
        avg_vol_low = sum(d["volume"] for d in low_carb_sessions) / len(low_carb_sessions)
        if avg_vol_low > 0:
            vol_diff_pct = round(((avg_vol_high - avg_vol_low) / avg_vol_low) * 100, 1)
            insights.append({
                "type": "carb_volume",
                "message_de": f"Bei >{ round(avg_carbs) }g Carbs am Vortag hebst du im Schnitt {abs(vol_diff_pct)}% {'mehr' if vol_diff_pct > 0 else 'weniger'} Volumen.",
                "message_en": f"With >{round(avg_carbs)}g carbs the day before, your volume is {abs(vol_diff_pct)}% {'higher' if vol_diff_pct > 0 else 'lower'} on average.",
                "diff_percent": vol_diff_pct,
                "threshold": round(avg_carbs),
            })

        avg_e1rm_high = sum(d["best_e1rm"] for d in high_carb_sessions) / len(high_carb_sessions)
        avg_e1rm_low = sum(d["best_e1rm"] for d in low_carb_sessions) / len(low_carb_sessions)
        if avg_e1rm_low > 0:
            e1rm_diff_pct = round(((avg_e1rm_high - avg_e1rm_low) / avg_e1rm_low) * 100, 1)
            insights.append({
                "type": "carb_strength",
                "message_de": f"Deine Maximalkraft ist im Schnitt {abs(e1rm_diff_pct)}% {'höher' if e1rm_diff_pct > 0 else 'niedriger'} nach carb-reichen Tagen (>{round(avg_carbs)}g).",
                "message_en": f"Your max strength is {abs(e1rm_diff_pct)}% {'higher' if e1rm_diff_pct > 0 else 'lower'} after high-carb days (>{round(avg_carbs)}g).",
                "diff_percent": e1rm_diff_pct,
            })

    # Protein impact
    avg_protein = sum(d["prev_day_protein"] for d in data_points) / len(data_points)
    high_protein = [d for d in data_points if d["prev_day_protein"] > avg_protein]
    low_protein = [d for d in data_points if d["prev_day_protein"] <= avg_protein]

    if high_protein and low_protein:
        avg_vol_hp = sum(d["volume"] for d in high_protein) / len(high_protein)
        avg_vol_lp = sum(d["volume"] for d in low_protein) / len(low_protein)
        if avg_vol_lp > 0:
            prot_diff = round(((avg_vol_hp - avg_vol_lp) / avg_vol_lp) * 100, 1)
            insights.append({
                "type": "protein_volume",
                "message_de": f"Bei >{round(avg_protein)}g Protein am Vortag ist dein Volumen {abs(prot_diff)}% {'höher' if prot_diff > 0 else 'niedriger'}.",
                "message_en": f"With >{round(avg_protein)}g protein the day before, your volume is {abs(prot_diff)}% {'higher' if prot_diff > 0 else 'lower'}.",
                "diff_percent": prot_diff,
                "threshold": round(avg_protein),
            })

    # Calorie surplus/deficit impact
    surplus_sessions = [d for d in data_points if d["prev_day_calories"] >= d["calorie_goal"] * 0.95]
    deficit_sessions = [d for d in data_points if d["prev_day_calories"] < d["calorie_goal"] * 0.95]

    if surplus_sessions and deficit_sessions:
        avg_vol_surplus = sum(d["volume"] for d in surplus_sessions) / len(surplus_sessions)
        avg_vol_deficit = sum(d["volume"] for d in deficit_sessions) / len(deficit_sessions)
        if avg_vol_deficit > 0:
            cal_diff = round(((avg_vol_surplus - avg_vol_deficit) / avg_vol_deficit) * 100, 1)
            insights.append({
                "type": "calorie_target",
                "message_de": f"Wenn du dein Kalorienziel erreichst, ist dein Trainingsvolumen {abs(cal_diff)}% {'höher' if cal_diff > 0 else 'niedriger'}.",
                "message_en": f"When you hit your calorie target, your training volume is {abs(cal_diff)}% {'higher' if cal_diff > 0 else 'lower'}.",
                "diff_percent": cal_diff,
            })

    return {
        "data_points": data_points,
        "insights": insights,
        "has_enough_data": len(data_points) >= 3,
        "total_correlated_workouts": len(data_points),
    }


# ════════════════════════════════════════════════════════
#  PROGRESSIVE OVERLOAD — per exercise history
# ════════════════════════════════════════════════════════

def compute_progressive_overload(workouts: list[dict]) -> list[dict]:
    """
    Build per-exercise progression data across all workouts.
    Returns: [{name, muscle_group, data_points: [{date, best_set, e1rm, volume, sets, reps}]}]
    """
    exercise_history = defaultdict(list)

    for w in workouts:
        workout_date = _extract_workout_date(w) or ""
        for ex in w.get("exercises", []):
            name = ex.get("title", "Unknown")
            muscle = ex.get("muscle_group", "")
            sets = ex.get("sets", [])

            best_e1rm = 0.0
            best_set_str = ""
            total_volume = 0.0
            total_sets = 0
            total_reps = 0

            for s in sets:
                weight = s.get("weight_kg") or 0
                reps = s.get("reps") or 0
                if weight > 0 and reps > 0:
                    total_volume += weight * reps
                    total_sets += 1
                    total_reps += reps
                    e1rm = weight * (1 + reps / 30.0)
                    if e1rm > best_e1rm:
                        best_e1rm = e1rm
                        best_set_str = f"{weight}kg × {reps}"

            if best_e1rm > 0:
                exercise_history[name].append({
                    "date": workout_date,
                    "best_set": best_set_str,
                    "e1rm": round(best_e1rm, 1),
                    "volume": round(total_volume, 1),
                    "sets": total_sets,
                    "reps": total_reps,
                    "muscle_group": muscle,
                })

    result = []
    for name, data_points in exercise_history.items():
        # Sort by date ascending
        data_points.sort(key=lambda d: d["date"])
        muscle = data_points[0].get("muscle_group", "") if data_points else ""

        # Compute trend
        if len(data_points) >= 2:
            first_e1rm = data_points[0]["e1rm"]
            last_e1rm = data_points[-1]["e1rm"]
            change_pct = round(((last_e1rm - first_e1rm) / first_e1rm) * 100, 1) if first_e1rm > 0 else 0
        else:
            change_pct = 0

        result.append({
            "name": name,
            "muscle_group": muscle,
            "data_points": data_points,
            "sessions_count": len(data_points),
            "first_e1rm": data_points[0]["e1rm"] if data_points else 0,
            "latest_e1rm": data_points[-1]["e1rm"] if data_points else 0,
            "peak_e1rm": max(d["e1rm"] for d in data_points) if data_points else 0,
            "change_percent": change_pct,
        })

    # Sort by number of sessions (most trained first)
    result.sort(key=lambda x: x["sessions_count"], reverse=True)
    return result


# ════════════════════════════════════════════════════════
#  WEEKLY STREAKS
# ════════════════════════════════════════════════════════

def compute_weekly_streaks(
    workout_dates: list[str],
    nutrition_dates: list[str],
) -> dict:
    """
    Compute weekly streaks for both training and nutrition.
    A week counts as 'active' if there is at least 1 workout or tracked day in that week.
    Weeks are ISO weeks (Mon-Sun).
    """
    def _dates_to_iso_weeks(dates: list[str]) -> set:
        weeks = set()
        for d in dates:
            try:
                dt = datetime.strptime(d, "%Y-%m-%d").date()
                iso_year, iso_week, _ = dt.isocalendar()
                weeks.add((iso_year, iso_week))
            except Exception:
                continue
        return weeks

    workout_weeks = _dates_to_iso_weeks(workout_dates)
    nutrition_weeks = _dates_to_iso_weeks(nutrition_dates)

    def _compute_streak(active_weeks: set) -> dict:
        if not active_weeks:
            return {"current_streak": 0, "longest_streak": 0, "total_active_weeks": 0}

        today = date.today()
        current_iso = today.isocalendar()
        current_week = (current_iso[0], current_iso[1])

        # Sort weeks ascending
        sorted_weeks = sorted(active_weeks)

        # Current streak (counting backwards from this week)
        current_streak = 0
        check_year, check_week = current_week
        while True:
            if (check_year, check_week) in active_weeks:
                current_streak += 1
                # Go to previous week
                check_date = datetime.strptime(f"{check_year}-W{check_week:02d}-1", "%G-W%V-%u").date()
                prev_date = check_date - timedelta(weeks=1)
                prev_iso = prev_date.isocalendar()
                check_year, check_week = prev_iso[0], prev_iso[1]
            else:
                break

        # Longest streak
        longest = 0
        streak = 0
        for i, (y, w) in enumerate(sorted_weeks):
            if i == 0:
                streak = 1
            else:
                prev_y, prev_w = sorted_weeks[i - 1]
                # Check if this is the next ISO week
                prev_date = datetime.strptime(f"{prev_y}-W{prev_w:02d}-1", "%G-W%V-%u").date()
                next_date = prev_date + timedelta(weeks=1)
                next_iso = next_date.isocalendar()
                if (y, w) == (next_iso[0], next_iso[1]):
                    streak += 1
                else:
                    streak = 1
            longest = max(longest, streak)

        return {
            "current_streak": current_streak,
            "longest_streak": longest,
            "total_active_weeks": len(active_weeks),
        }

    # Combined streak (either training OR nutrition in a week)
    combined_weeks = workout_weeks | nutrition_weeks

    return {
        "training": _compute_streak(workout_weeks),
        "nutrition": _compute_streak(nutrition_weeks),
        "combined": _compute_streak(combined_weeks),
    }


# ════════════════════════════════════════════════════════
#  WEEKLY / MONTHLY REPORTS
# ════════════════════════════════════════════════════════

def compute_weekly_report(
    workouts: list[dict],
    nutrition_by_date: dict,
    weight_entries: list[dict],
    week_offset: int = 0,
) -> dict:
    """
    Compute a report for a given week (0 = current week, 1 = last week, etc.)
    """
    today = date.today()
    # Get the Monday of the target week
    current_monday = today - timedelta(days=today.weekday())
    target_monday = current_monday - timedelta(weeks=week_offset)
    target_sunday = target_monday + timedelta(days=6)

    date_range = [target_monday + timedelta(days=i) for i in range(7)]
    date_strs = [d.isoformat() for d in date_range]

    # Filter workouts in this week
    week_workouts = []
    for w in workouts:
        wd = _extract_workout_date(w)
        if wd and target_monday.isoformat() <= wd <= target_sunday.isoformat():
            week_workouts.append(w)

    # Total volume for the week
    total_volume = 0.0
    total_sets = 0
    total_duration = 0
    muscle_groups_trained = defaultdict(int)

    for w in week_workouts:
        if w.get("duration_min"):
            total_duration += w["duration_min"]
        for ex in w.get("exercises", []):
            mg = ex.get("muscle_group", "other")
            for s in ex.get("sets", []):
                weight = s.get("weight_kg") or 0
                reps = s.get("reps") or 0
                if weight > 0 and reps > 0:
                    total_volume += weight * reps
                    total_sets += 1
                    muscle_groups_trained[mg] += 1

    # Nutrition averages for the week
    week_nutrition = [nutrition_by_date[d] for d in date_strs if d in nutrition_by_date]
    avg_calories = round(sum(n.get("calories", 0) for n in week_nutrition) / max(1, len(week_nutrition)), 1) if week_nutrition else 0
    avg_protein = round(sum(n.get("protein", 0) for n in week_nutrition) / max(1, len(week_nutrition)), 1) if week_nutrition else 0
    avg_carbs = round(sum(n.get("carbs", 0) for n in week_nutrition) / max(1, len(week_nutrition)), 1) if week_nutrition else 0
    avg_fat = round(sum(n.get("fat", 0) for n in week_nutrition) / max(1, len(week_nutrition)), 1) if week_nutrition else 0
    days_tracked = len(week_nutrition)

    # Weight for the week
    week_weights = [we for we in weight_entries if target_monday.isoformat() <= we["date"] <= target_sunday.isoformat()]
    start_weight = week_weights[0]["weight_kg"] if week_weights else None
    end_weight = week_weights[-1]["weight_kg"] if week_weights else None
    weight_change = round(end_weight - start_weight, 2) if start_weight and end_weight else None

    return {
        "week_start": target_monday.isoformat(),
        "week_end": target_sunday.isoformat(),
        "week_offset": week_offset,
        "training": {
            "workouts_count": len(week_workouts),
            "total_volume_kg": round(total_volume, 1),
            "total_sets": total_sets,
            "total_duration_min": total_duration,
            "muscle_groups": dict(muscle_groups_trained),
            "workout_names": [w.get("title", "Workout") for w in week_workouts],
        },
        "nutrition": {
            "days_tracked": days_tracked,
            "avg_calories": avg_calories,
            "avg_protein": avg_protein,
            "avg_carbs": avg_carbs,
            "avg_fat": avg_fat,
            "calorie_goal": week_nutrition[0].get("goals", {}).get("calories", 0) if week_nutrition else 0,
            "protein_goal": week_nutrition[0].get("goals", {}).get("protein", 0) if week_nutrition else 0,
        },
        "weight": {
            "start": start_weight,
            "end": end_weight,
            "change": weight_change,
        },
    }


def compute_monthly_report(
    workouts: list[dict],
    nutrition_by_date: dict,
    weight_entries: list[dict],
    month_offset: int = 0,
) -> dict:
    """
    Compute a report for a given month (0 = current month, 1 = last month, etc.)
    """
    today = date.today()
    # Get target month start
    target_month = today.month - month_offset
    target_year = today.year
    while target_month <= 0:
        target_month += 12
        target_year -= 1

    month_start = date(target_year, target_month, 1)
    if target_month == 12:
        month_end = date(target_year + 1, 1, 1) - timedelta(days=1)
    else:
        month_end = date(target_year, target_month + 1, 1) - timedelta(days=1)

    # Filter workouts in this month
    month_workouts = []
    total_volume = 0.0
    total_sets = 0
    total_duration = 0
    muscle_groups_trained = defaultdict(int)
    best_e1rms = {}

    for w in workouts:
        wd = _extract_workout_date(w)
        if wd and month_start.isoformat() <= wd <= month_end.isoformat():
            month_workouts.append(w)
            if w.get("duration_min"):
                total_duration += w["duration_min"]
            for ex in w.get("exercises", []):
                name = ex.get("title", "Unknown")
                mg = ex.get("muscle_group", "other")
                for s in ex.get("sets", []):
                    weight = s.get("weight_kg") or 0
                    reps = s.get("reps") or 0
                    if weight > 0 and reps > 0:
                        total_volume += weight * reps
                        total_sets += 1
                        muscle_groups_trained[mg] += 1
                        e1rm = weight * (1 + reps / 30.0)
                        if name not in best_e1rms or e1rm > best_e1rms[name]:
                            best_e1rms[name] = round(e1rm, 1)

    # Nutrition
    month_dates = [(month_start + timedelta(days=i)).isoformat()
                   for i in range((month_end - month_start).days + 1)]
    month_nutrition = [nutrition_by_date[d] for d in month_dates if d in nutrition_by_date]
    days_tracked = len(month_nutrition)
    avg_calories = round(sum(n.get("calories", 0) for n in month_nutrition) / max(1, days_tracked)) if month_nutrition else 0
    avg_protein = round(sum(n.get("protein", 0) for n in month_nutrition) / max(1, days_tracked)) if month_nutrition else 0

    # Weight
    month_weights = [we for we in weight_entries if month_start.isoformat() <= we["date"] <= month_end.isoformat()]
    start_weight = month_weights[0]["weight_kg"] if month_weights else None
    end_weight = month_weights[-1]["weight_kg"] if month_weights else None

    return {
        "month": f"{target_year}-{target_month:02d}",
        "month_start": month_start.isoformat(),
        "month_end": month_end.isoformat(),
        "month_offset": month_offset,
        "training": {
            "workouts_count": len(month_workouts),
            "total_volume_kg": round(total_volume, 1),
            "total_sets": total_sets,
            "total_duration_min": total_duration,
            "muscle_groups": dict(muscle_groups_trained),
            "best_e1rms": best_e1rms,
        },
        "nutrition": {
            "days_tracked": days_tracked,
            "avg_calories": avg_calories,
            "avg_protein": avg_protein,
        },
        "weight": {
            "start": start_weight,
            "end": end_weight,
            "change": round(end_weight - start_weight, 2) if start_weight and end_weight else None,
        },
    }


# ════════════════════════════════════════════════════════
#  ACHIEVEMENTS / BADGES
# ════════════════════════════════════════════════════════

def compute_achievements(
    workouts: list[dict],
    nutrition_dates: list[str],
    workout_dates: list[str],
    weight_entries: list[dict],
    nutrition_by_date: dict,
) -> list[dict]:
    """
    Compute all unlocked + locked achievements.
    Returns a list of achievement dicts, each with:
    - id, name_de, name_en, desc_de, desc_en, icon, category, unlocked, unlocked_date, progress, target
    """

    achievements = []

    # ── Helpers ──
    all_exercises = defaultdict(list)  # name -> list of {date, e1rm, volume}
    total_workouts = len(workouts)
    total_volume_all_time = 0.0
    all_workout_dates = set()
    exercise_prs = {}  # name -> max e1rm

    for w in workouts:
        wd = _extract_workout_date(w) or ""
        all_workout_dates.add(wd)
        for ex in w.get("exercises", []):
            name = ex.get("title", "Unknown")
            for s in ex.get("sets", []):
                weight = s.get("weight_kg") or 0
                reps = s.get("reps") or 0
                if weight > 0 and reps > 0:
                    total_volume_all_time += weight * reps
                    e1rm = weight * (1 + reps / 30.0)
                    all_exercises[name].append({"date": wd, "e1rm": e1rm, "weight": weight, "reps": reps})
                    if name not in exercise_prs or e1rm > exercise_prs[name]:
                        exercise_prs[name] = e1rm

    total_nutrition_days = len(nutrition_dates)

    # ── WORKOUT COUNT ACHIEVEMENTS ──
    workout_milestones = [
        (1, "first_workout", "Erste Session", "First Session", "Dein erstes Workout!", "Your first workout!", "🏋️"),
        (10, "10_workouts", "10 Workouts", "10 Workouts", "10 Workouts geschafft!", "Completed 10 workouts!", "💪"),
        (25, "25_workouts", "25 Workouts", "25 Workouts", "25 Workouts — das ist Hingabe!", "25 workouts — that's dedication!", "🔥"),
        (50, "50_workouts", "50 Sessions", "50 Sessions", "50 Workouts, du bist ein Beast!", "50 workouts, you're a beast!", "🦁"),
        (100, "100_workouts", "Century Club", "Century Club", "100 Workouts — du bist eine Legende!", "100 workouts — legendary!", "🏆"),
        (200, "200_workouts", "Gym Rat", "Gym Rat", "200 Workouts — das Gym ist dein Zuhause!", "200 workouts — the gym is your home!", "🐀"),
    ]
    for target, aid, name_de, name_en, desc_de, desc_en, icon in workout_milestones:
        achievements.append({
            "id": aid,
            "name_de": name_de, "name_en": name_en,
            "desc_de": desc_de, "desc_en": desc_en,
            "icon": icon,
            "category": "training",
            "unlocked": total_workouts >= target,
            "unlocked_date": None,
            "progress": min(total_workouts, target),
            "target": target,
        })

    # ── VOLUME ACHIEVEMENTS ──
    vol_milestones = [
        (10000, "10k_volume", "10 Tonnen", "10 Tons", "10.000 kg Gesamtvolumen!", "10,000 kg total volume!", "⚡"),
        (50000, "50k_volume", "50 Tonnen", "50 Tons", "50.000 kg — du hast einen LKW gehoben!", "50,000 kg — you lifted a truck!", "🚛"),
        (100000, "100k_volume", "100K Club", "100K Club", "100.000 kg Gesamtvolumen!", "100,000 kg total volume!", "💎"),
        (500000, "500k_volume", "Halbmillionär", "Half Million", "500.000 kg — unfassbar!", "500,000 kg — incredible!", "🌟"),
        (1000000, "1m_volume", "Millionär", "Millionaire", "1.000.000 kg Volumen. Respekt.", "1,000,000 kg volume. Respect.", "👑"),
    ]
    for target, aid, name_de, name_en, desc_de, desc_en, icon in vol_milestones:
        achievements.append({
            "id": aid,
            "name_de": name_de, "name_en": name_en,
            "desc_de": desc_de, "desc_en": desc_en,
            "icon": icon,
            "category": "training",
            "unlocked": total_volume_all_time >= target,
            "unlocked_date": None,
            "progress": min(round(total_volume_all_time), target),
            "target": target,
        })

    # ── STRENGTH MILESTONES (specific exercises) ──
    strength_targets = [
        ("Bench Press (Barbell)", 60, "bench_60", "60kg Bank", "60kg Bench", "60kg Bankdrücken!", "60kg bench press!", "🏋️"),
        ("Bench Press (Barbell)", 80, "bench_80", "80kg Bank", "80kg Bench", "80kg Bankdrücken!", "80kg bench press!", "🏋️"),
        ("Bench Press (Barbell)", 100, "bench_100", "100kg Bank", "100kg Bench", "100kg Bankdrücken — willkommen im Club!", "100kg bench press — welcome to the club!", "🏅"),
        ("Bench Press (Barbell)", 140, "bench_140", "140kg Bank", "140kg Bench", "140kg Bankdrücken — Elite!", "140kg bench — Elite!", "🥇"),
        ("Squat (Barbell)", 100, "squat_100", "100kg Kniebeuge", "100kg Squat", "100kg Squat geschafft!", "100kg squat achieved!", "🦵"),
        ("Squat (Barbell)", 140, "squat_140", "140kg Kniebeuge", "140kg Squat", "140kg Squat — mörderisch!", "140kg squat — killer!", "🦵"),
        ("Squat (Barbell)", 180, "squat_180", "180kg Kniebeuge", "180kg Squat", "180kg Squat — absolutes Beast!", "180kg squat — absolute beast!", "🦵"),
        ("Deadlift (Barbell)", 100, "deadlift_100", "100kg Kreuzheben", "100kg Deadlift", "100kg Kreuzheben!", "100kg deadlift!", "💀"),
        ("Deadlift (Barbell)", 140, "deadlift_140", "140kg Kreuzheben", "140kg Deadlift", "140kg Kreuzheben!", "140kg deadlift!", "💀"),
        ("Deadlift (Barbell)", 180, "deadlift_180", "180kg Kreuzheben", "180kg Deadlift", "180kg Kreuzheben — Biest!", "180kg deadlift — Beast!", "💀"),
        ("Deadlift (Barbell)", 220, "deadlift_220", "220kg Kreuzheben", "220kg Deadlift", "220kg Kreuzheben — Legendenstatus!", "220kg deadlift — Legendary!", "💀"),
        ("Overhead Press (Barbell)", 60, "ohp_60", "60kg OHP", "60kg OHP", "60kg Overhead Press!", "60kg overhead press!", "🙌"),
        ("Overhead Press (Barbell)", 80, "ohp_80", "80kg OHP", "80kg OHP", "80kg Overhead Press — stark!", "80kg OHP — strong!", "🙌"),
    ]

    for ex_name, target_kg, aid, name_de, name_en, desc_de, desc_en, icon in strength_targets:
        # Check all exercise name variants
        max_weight = 0
        for ename, data_list in all_exercises.items():
            if ex_name.lower() in ename.lower():
                for d in data_list:
                    if d["weight"] > max_weight:
                        max_weight = d["weight"]
        achievements.append({
            "id": aid,
            "name_de": name_de, "name_en": name_en,
            "desc_de": desc_de, "desc_en": desc_en,
            "icon": icon,
            "category": "strength",
            "unlocked": max_weight >= target_kg,
            "unlocked_date": None,
            "progress": min(round(max_weight), target_kg),
            "target": target_kg,
        })

    # ── NUTRITION ACHIEVEMENTS ──
    nutrition_milestones = [
        (7, "7_days_tracked", "Eine Woche getrackt", "One Week Tracked", "7 Tage Ernährung getrackt!", "7 days of nutrition tracked!", "🥗"),
        (30, "30_days_tracked", "Ein Monat getrackt", "One Month Tracked", "30 Tage getrackt — top Disziplin!", "30 days tracked — great discipline!", "📊"),
        (90, "90_days_tracked", "Quartals-Tracker", "Quarterly Tracker", "90 Tage Ernährung getrackt!", "90 days tracked!", "📈"),
        (180, "180_days_tracked", "Halb-Jahres-Tracker", "Half Year Tracker", "180 Tage — ein halbes Jahr Ernährungstracking!", "180 days — half a year of tracking!", "🌟"),
        (365, "365_days_tracked", "Jahres-Tracker", "Year Tracker", "365 Tage — ein ganzes Jahr getrackt!", "365 days tracked — a full year!", "👑"),
    ]
    for target, aid, name_de, name_en, desc_de, desc_en, icon in nutrition_milestones:
        achievements.append({
            "id": aid,
            "name_de": name_de, "name_en": name_en,
            "desc_de": desc_de, "desc_en": desc_en,
            "icon": icon,
            "category": "nutrition",
            "unlocked": total_nutrition_days >= target,
            "unlocked_date": None,
            "progress": min(total_nutrition_days, target),
            "target": target,
        })

    # ── PROTEIN TARGET ACHIEVEMENTS ──
    protein_target_days = 0
    for d, nutr in nutrition_by_date.items():
        protein_goal = nutr.get("goals", {}).get("protein", 0)
        actual_protein = nutr.get("protein", 0)
        if protein_goal > 0 and actual_protein >= protein_goal * 0.95:
            protein_target_days += 1

    prot_milestones = [
        (7, "protein_7", "Protein-Woche", "Protein Week", "7 Tage Protein-Ziel erreicht!", "Hit protein target 7 days!", "🥩"),
        (30, "protein_30", "Protein-Monat", "Protein Month", "30 Tage Protein-Ziel — Muskeln sagen danke!", "30 days protein target — muscles say thanks!", "🥩"),
        (100, "protein_100", "Protein-Maschine", "Protein Machine", "100 Tage Protein-Ziel erreicht!", "100 days hitting protein target!", "🥩"),
    ]
    for target, aid, name_de, name_en, desc_de, desc_en, icon in prot_milestones:
        achievements.append({
            "id": aid,
            "name_de": name_de, "name_en": name_en,
            "desc_de": desc_de, "desc_en": desc_en,
            "icon": icon,
            "category": "nutrition",
            "unlocked": protein_target_days >= target,
            "unlocked_date": None,
            "progress": min(protein_target_days, target),
            "target": target,
        })

    # ── STREAK ACHIEVEMENTS ──
    training_weeks = set()
    for d in workout_dates:
        try:
            dt = datetime.strptime(d, "%Y-%m-%d").date()
            iso = dt.isocalendar()
            training_weeks.add((iso[0], iso[1]))
        except Exception:
            continue

    # Compute longest training streak
    training_streak = compute_weekly_streaks(workout_dates, nutrition_dates)
    longest_training = training_streak["training"]["longest_streak"]
    longest_combined = training_streak["combined"]["longest_streak"]

    streak_milestones = [
        (4, "streak_4", "4-Wochen-Streak", "4 Week Streak", "4 Wochen am Stück trainiert!", "4 consecutive weeks of training!", "🔥"),
        (8, "streak_8", "8-Wochen-Streak", "8 Week Streak", "8 Wochen am Stück — Gewohnheit geformt!", "8 weeks straight — habit formed!", "🔥"),
        (12, "streak_12", "Quartals-Streak", "Quarter Streak", "12 Wochen Streak — nichts hält dich auf!", "12 week streak — unstoppable!", "💫"),
        (26, "streak_26", "Halbjahres-Streak", "Half Year Streak", "26 Wochen Streak — Lifestyle!", "26 week streak — lifestyle!", "⭐"),
        (52, "streak_52", "Jahres-Streak", "Year Streak", "52 Wochen — ein ganzes Jahr durchgezogen!", "52 week streak — a full year!", "👑"),
    ]
    for target, aid, name_de, name_en, desc_de, desc_en, icon in streak_milestones:
        achievements.append({
            "id": aid,
            "name_de": name_de, "name_en": name_en,
            "desc_de": desc_de, "desc_en": desc_en,
            "icon": icon,
            "category": "consistency",
            "unlocked": longest_training >= target,
            "unlocked_date": None,
            "progress": min(longest_training, target),
            "target": target,
        })

    # ── WEIGHT ACHIEVEMENTS ──
    if weight_entries and len(weight_entries) >= 2:
        first_w = weight_entries[0]["weight_kg"]
        last_w = weight_entries[-1]["weight_kg"]
        total_change = abs(round(last_w - first_w, 1))

        weight_milestones = [
            (2, "weight_2kg", "2kg Veränderung", "2kg Change", "2kg Gewichtsveränderung!", "2kg body weight change!", "⚖️"),
            (5, "weight_5kg", "5kg Veränderung", "5kg Change", "5kg Körpergewicht verändert!", "5kg body weight change!", "⚖️"),
            (10, "weight_10kg", "10kg Transformation", "10kg Transform", "10kg — das ist eine Transformation!", "10kg — that's a transformation!", "🔄"),
        ]
        for target, aid, name_de, name_en, desc_de, desc_en, icon in weight_milestones:
            achievements.append({
                "id": aid,
                "name_de": name_de, "name_en": name_en,
                "desc_de": desc_de, "desc_en": desc_en,
                "icon": icon,
                "category": "body",
                "unlocked": total_change >= target,
                "unlocked_date": None,
                "progress": min(round(total_change, 1), target),
                "target": target,
            })

    # ── EXERCISE VARIETY ──
    unique_exercises = len(all_exercises)
    variety_milestones = [
        (10, "variety_10", "10 Übungen", "10 Exercises", "10 verschiedene Übungen gemacht!", "Performed 10 different exercises!", "🎯"),
        (25, "variety_25", "25 Übungen", "25 Exercises", "25 verschiedene Übungen — vielseitig!", "25 different exercises — versatile!", "🎯"),
        (50, "variety_50", "50 Übungen", "50 Exercises", "50 verschiedene Übungen — komplett!", "50 different exercises — complete!", "🎯"),
    ]
    for target, aid, name_de, name_en, desc_de, desc_en, icon in variety_milestones:
        achievements.append({
            "id": aid,
            "name_de": name_de, "name_en": name_en,
            "desc_de": desc_de, "desc_en": desc_en,
            "icon": icon,
            "category": "training",
            "unlocked": unique_exercises >= target,
            "unlocked_date": None,
            "progress": min(unique_exercises, target),
            "target": target,
        })

    return achievements
