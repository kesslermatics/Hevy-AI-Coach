"""
Google Gemini integration – generates the daily morning briefing.

Uses gemini-2.0-flash for fast, cost-effective structured output.
"""
import json
import logging
import re
from typing import Optional

from google import genai
from google.genai import types

from app.config import settings

logger = logging.getLogger(__name__)

# Default fallback when AI fails
FALLBACK_BRIEFING = {
    "readiness_score": 50,
    "nutrition_review": "Unable to generate nutrition review — please check your Yazio connection.",
    "workout_suggestion": "Unable to generate workout suggestion — please check your Hevy connection.",
    "daily_mission": "Stay consistent and keep tracking your progress! 💪",
}


def _build_system_prompt(profile: Optional[dict]) -> str:
    """Build the system prompt for the AI with user-specific context from Yazio."""
    # Extract profile info (all from Yazio)
    p = profile or {}
    name = " ".join(filter(None, [p.get("first_name"), p.get("last_name")])) or "Athlete"
    goal = (p.get("goal") or "general fitness").replace("_", " ")
    sex = p.get("sex", "")
    height = p.get("body_height_cm")
    current_weight = p.get("current_weight_kg")
    start_weight = p.get("start_weight_kg")
    dob = p.get("date_of_birth", "")
    activity = (p.get("activity_degree") or "").replace("_", " ")
    diet_name = (p.get("diet_name") or "").replace("_", " ")
    diet_macros = ""
    if p.get("diet_protein_pct"):
        diet_macros = (f" (P: {p['diet_protein_pct']}% / "
                       f"C: {p.get('diet_carb_pct', '?')}% / "
                       f"F: {p.get('diet_fat_pct', '?')}%)")
    weight_change = p.get("weight_change_per_week_kg")

    # Build user context lines (skip missing data)
    context_lines: list[str] = [f"The user's name is **{name}**."]
    if sex:
        context_lines.append(f"Sex: {sex}.")
    if dob:
        context_lines.append(f"Date of birth: {dob}.")
    if height:
        context_lines.append(f"Height: {height} cm.")
    if current_weight:
        context_lines.append(f"Current weight: {current_weight} kg.")
    if start_weight and current_weight and abs(start_weight - current_weight) > 0.5:
        context_lines.append(f"Start weight: {start_weight} kg (progress: {round(start_weight - current_weight, 1)} kg).")
    context_lines.append(f"Goal: **{goal}**.")
    if weight_change:
        context_lines.append(f"Target weight change: {weight_change} kg/week.")
    if activity:
        context_lines.append(f"Activity level: {activity}.")
    if diet_name:
        context_lines.append(f"Diet: {diet_name}{diet_macros}.")

    user_context = "\n".join(context_lines)

    return f"""You are an elite, no-nonsense fitness coach. Your name is Coach.

=== USER PROFILE ===
{user_context}

You will receive:
1. Yesterday's nutrition data from Yazio (may be partial or missing entirely).
2. The last 5 completed workouts from Hevy (exercises, sets, weights).

Your job:
- Address the user by their first name.
- Analyze the last 5 workouts to deduce which muscle groups have been trained recently and which are recovered. Suggest a smart workout focus for TODAY based on recovery and training frequency.
- Review yesterday's nutrition. Comment on calorie intake, macros, and how well they align with the user's goal and diet plan.
- Consider the user's body stats (height, weight, goal) when evaluating nutrition and training.
- Do NOT mention water intake if it is 0, missing, or clearly not tracked.
- Do NOT mention data that is clearly missing or zero — just skip it gracefully.
- Be motivating but direct. Use short sentences.

You MUST respond with valid JSON matching this exact schema:
{{
  "readiness_score": <int 0-100, overall readiness based on recovery + nutrition>,
  "nutrition_review": "<string, 2-4 sentences reviewing yesterday's food>",
  "workout_suggestion": "<string, 2-4 sentences suggesting today's training focus with reasoning>",
  "daily_mission": "<string, one motivational sentence or actionable micro-goal for today>"
}}

Respond ONLY with the JSON object. No markdown, no explanation."""


def _build_user_message(yazio_data: Optional[dict], hevy_data: Optional[list]) -> str:
    """Build the user message containing the raw context data."""
    parts: list[str] = []

    # ── Nutrition ────────────────────────────────────────
    if yazio_data:
        totals = yazio_data.get("totals", {})
        goals = yazio_data.get("goals", {})
        meals = yazio_data.get("meals", {})

        parts.append("=== YESTERDAY'S NUTRITION (Yazio) ===")
        parts.append(f"Total: {totals.get('calories', 0)} kcal | "
                     f"P: {totals.get('protein', 0)}g | "
                     f"C: {totals.get('carbs', 0)}g | "
                     f"F: {totals.get('fat', 0)}g")
        parts.append(f"Goals: {goals.get('calories', 0)} kcal | "
                     f"P: {goals.get('protein', 0)}g | "
                     f"C: {goals.get('carbs', 0)}g | "
                     f"F: {goals.get('fat', 0)}g")

        # Per-meal breakdown (only non-zero)
        for meal_key, meal_vals in meals.items():
            cal = meal_vals.get("calories", 0)
            if cal > 0:
                parts.append(f"  {meal_key.title()}: {cal} kcal | "
                             f"P: {meal_vals.get('protein', 0)}g | "
                             f"C: {meal_vals.get('carbs', 0)}g | "
                             f"F: {meal_vals.get('fat', 0)}g")

        # Water only if tracked
        water = yazio_data.get("water_ml", 0)
        if water and water > 0:
            parts.append(f"Water: {water} ml / {yazio_data.get('water_goal_ml', 0)} ml")

        steps = yazio_data.get("steps", 0)
        if steps and steps > 0:
            parts.append(f"Steps: {steps:,} | Activity burn: {yazio_data.get('activity_kcal', 0)} kcal")
    else:
        parts.append("=== NUTRITION: No data available (Yazio not connected or no tracking yesterday) ===")

    parts.append("")

    # ── Workouts ─────────────────────────────────────────
    if hevy_data:
        parts.append("=== LAST 5 WORKOUTS (Hevy) ===")
        for i, w in enumerate(hevy_data, 1):
            dur = f" ({w['duration_min']} min)" if w.get("duration_min") else ""
            parts.append(f"\nWorkout {i}: {w.get('title', 'Untitled')}{dur} — {w.get('start_time', '?')}")
            for ex in w.get("exercises", []):
                sets_summary = []
                for s in ex.get("sets", []):
                    weight = s.get("weight_kg")
                    reps = s.get("reps")
                    if weight is not None and reps is not None:
                        sets_summary.append(f"{weight}kg×{reps}")
                    elif reps is not None:
                        sets_summary.append(f"{reps} reps")
                    elif s.get("duration_seconds"):
                        sets_summary.append(f"{s['duration_seconds']}s")
                sets_str = ", ".join(sets_summary) if sets_summary else "no set data"
                muscle = f" [{ex.get('muscle_group')}]" if ex.get("muscle_group") else ""
                parts.append(f"  • {ex.get('title', '?')}{muscle}: {sets_str}")
    else:
        parts.append("=== WORKOUTS: No data available (Hevy not connected or no workouts found) ===")

    return "\n".join(parts)


async def generate_daily_briefing(
    yazio_data: Optional[dict],
    hevy_data: Optional[list],
) -> dict:
    """
    Call Google Gemini to generate a morning briefing.

    Returns a dict with keys: readiness_score, nutrition_review,
    workout_suggestion, daily_mission.
    Falls back to FALLBACK_BRIEFING if anything goes wrong.
    """
    client = genai.Client(api_key=settings.gemini_api_key)

    # Extract profile from Yazio data (name, height, weight, goal, diet…)
    profile = yazio_data.get("profile") if yazio_data else None
    system_prompt = _build_system_prompt(profile)
    user_message = _build_user_message(yazio_data, hevy_data)

    try:
        response = await client.aio.models.generate_content(
            model="gemini-3-flash-preview",
            contents=user_message,
            config=types.GenerateContentConfig(
                system_instruction=system_prompt,
                temperature=0.7,
                max_output_tokens=2048,
                response_mime_type="application/json",
            ),
        )

        raw_content = response.text
        if not raw_content:
            logger.error("Gemini returned empty content")
            return FALLBACK_BRIEFING

        # Strip markdown fences if Gemini wraps it
        cleaned = re.sub(r"^```(?:json)?\s*", "", raw_content.strip())
        cleaned = re.sub(r"\s*```$", "", cleaned)

        parsed = json.loads(cleaned)

        # Validate required keys exist
        required_keys = {"readiness_score", "nutrition_review", "workout_suggestion", "daily_mission"}
        if not required_keys.issubset(parsed.keys()):
            missing = required_keys - set(parsed.keys())
            logger.warning("AI response missing keys: %s", missing)
            return {**FALLBACK_BRIEFING, **parsed}

        # Clamp readiness score
        parsed["readiness_score"] = max(0, min(100, int(parsed["readiness_score"])))

        return parsed

    except json.JSONDecodeError as exc:
        logger.error("Failed to parse Gemini JSON response: %s — raw: %s", exc, raw_content[:500])
        return FALLBACK_BRIEFING
    except Exception as exc:
        logger.error("Gemini API error: %s", exc)
        return FALLBACK_BRIEFING
