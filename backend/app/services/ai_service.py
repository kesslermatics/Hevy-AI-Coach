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
    "nutrition_review": {
        "calories": "Unable to load calorie data.",
        "protein": "Unable to load protein data.",
        "carbs": "Unable to load carbs data.",
        "fat": "Unable to load fat data.",
    },
    "workout_suggestion": "Unable to generate workout suggestion — please check your Hevy connection.",
    "weight_trend": "Unable to load weight data.",
    "daily_mission": "Stay consistent and keep tracking your progress! 💪",
    "weather_note": "",
    "muscle_recovery": {},
}

FALLBACK_SESSION_REVIEW = {
    "last_session": None,
    "next_session": None,
}

FALLBACK_WORKOUT_TIPS = {
    "workout_title": "Unknown",
    "workout_date": "",
    "nutrition_context": "Unable to load nutrition context.",
    "exercise_tips": [],
    "new_exercises_to_try": [],
    "general_advice": "",
}

# CS2-style rank tiers
RANK_TIERS = [
    "Silver I", "Silver II", "Silver III", "Silver IV",
    "Gold Nova I", "Gold Nova II", "Gold Nova III", "Gold Nova Master",
    "Master Guardian I", "Master Guardian II", "Master Guardian Elite",
    "Distinguished Master Guardian", "Legendary Eagle", "Legendary Eagle Master",
    "Supreme Master First Class", "Global Elite",
]


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

    return f"""You are a supportive, friendly fitness coach. Your name is Coach.

=== USER PROFILE ===
{user_context}

You will receive:
1. Yesterday's nutrition data from Yazio (may be partial or missing entirely).
2. The last few completed workouts from Hevy (exercises, sets, weights).
3. Current weather data (may be missing).

Your job:
- Address the user by their first name.
- Analyze recent workouts to deduce which muscle groups have been trained recently and which are recovered. Suggest a smart workout focus for TODAY based on recovery and training frequency.
- Review yesterday's nutrition per macro category. Be encouraging and realistic — nobody hits their macros perfectly every day, and that's okay. Acknowledge what went well, and give a gentle nudge where there's room to improve.
- Small deviations (±10-15%) from targets are totally normal and should be praised or ignored, not criticized.
- Only flag something if it's significantly off (e.g. 30%+ deviation).
- Consider the user's body stats (height, weight, goal) when evaluating nutrition and training.
- Do NOT mention water intake if it is 0, missing, or clearly not tracked.
- Do NOT mention data that is clearly missing or zero — just skip it gracefully.
- Keep it short, warm, and motivating. Use short sentences.

For each macro in nutrition_review, ALWAYS include the actual number and the goal number (e.g. "2100 of 2500 kcal — solid, right on track!").

**weight_trend**: Based on the user's current weight, start weight, goal, and target weight change per week, write a short, encouraging summary of their weight journey. Mention current weight, how far they've come from their start weight, how far to their goal, and whether the pace is good. Be specific with numbers. If the user is bulking, frame weight gain positively. If cutting, frame weight loss positively. If no weight data is available, say "No weight data available yet — start tracking to see your progress!"

**daily_mission**: Give ONE very specific, concrete, actionable micro-task for today. NOT generic motivation. Examples:
- "Eat a banana 30 min before your workout for quick carbs."
- "Focus on 3-second eccentrics on every bench press rep today."
- "Add one extra set of lateral raises at the end of your session."
- "Drink a protein shake within 30 min after training."
The mission should relate to either today's workout or yesterday's nutrition gaps.

**weather_note**: If weather data is provided, write 1-2 full sentences describing today's weather naturally. Include the current temperature, the expected low and high for the day, and the conditions. Then optionally connect it to the workout. Example: "Right now it's 5°C with light rain — expect lows of 2°C and highs of 8°C today. Perfect excuse to hit the gym instead of running outside!" If no weather data, leave this as an empty string.

**muscle_recovery**: Based on the recent workout history, estimate the recovery percentage (0-100) for each major muscle group. 0 = just trained / completely fatigued, 100 = fully recovered and ready to train. Use these exact keys: "chest", "back", "shoulders", "biceps", "triceps", "forearms", "abs", "quads", "hamstrings", "glutes", "calves". Consider:
- A muscle group trained today or yesterday: 0-30%
- Trained 2 days ago: 30-60%
- Trained 3 days ago: 60-80%
- Trained 4+ days ago or never: 80-100%
- Compound movements affect multiple groups (e.g. bench press → chest, triceps, shoulders)
If no workout data is available, set all values to 100.

You MUST respond with valid JSON matching this exact schema:
{{
  "nutrition_review": {{
    "calories": "<string, ONE short sentence WITH actual/goal numbers>",
    "protein": "<string, ONE short sentence WITH actual/goal grams>",
    "carbs": "<string, ONE short sentence WITH actual/goal grams>",
    "fat": "<string, ONE short sentence WITH actual/goal grams>"
  }},
  "workout_suggestion": "<string, 2-3 sentences suggesting today's training focus>",
  "weight_trend": "<string, 2-3 sentences about weight progress with actual numbers>",
  "daily_mission": "<string, ONE specific actionable micro-task for today>",
  "weather_note": "<string, 1-2 sentences with current temp, daily low/high, conditions, and optional workout connection — or empty string if no weather data>",
  "muscle_recovery": {{
    "chest": <int 0-100>,
    "back": <int 0-100>,
    "shoulders": <int 0-100>,
    "biceps": <int 0-100>,
    "triceps": <int 0-100>,
    "forearms": <int 0-100>,
    "abs": <int 0-100>,
    "quads": <int 0-100>,
    "hamstrings": <int 0-100>,
    "glutes": <int 0-100>,
    "calves": <int 0-100>
  }}
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
        parts.append(f"=== LAST {len(hevy_data)} WORKOUTS (Hevy) ===")
        parts.append("(Workout 1 = most recent, use it for last_session analysis)")
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
    weather_data: Optional[dict] = None,
) -> dict:
    """
    Call Google Gemini to generate a morning briefing.

    Returns a dict with keys: nutrition_review, workout_suggestion,
    weight_trend, daily_mission, weather_note.
    Falls back to FALLBACK_BRIEFING if anything goes wrong.
    """
    client = genai.Client(api_key=settings.gemini_api_key)

    # Extract profile from Yazio data (name, height, weight, goal, diet…)
    profile = yazio_data.get("profile") if yazio_data else None
    system_prompt = _build_system_prompt(profile)
    user_message = _build_user_message(yazio_data, hevy_data)

    # Append weather data if available
    if weather_data:
        user_message += (
            f"\n\n=== CURRENT WEATHER ===\n"
            f"Current Temperature: {weather_data.get('temperature_c', '?')}°C\n"
            f"Today's Low: {weather_data.get('temp_min_c', '?')}°C\n"
            f"Today's High: {weather_data.get('temp_max_c', '?')}°C\n"
            f"Current Condition: {weather_data.get('condition', 'Unknown')}\n"
            f"Daily Condition: {weather_data.get('daily_condition', weather_data.get('condition', 'Unknown'))}\n"
            f"Wind: {weather_data.get('windspeed_kmh', '?')} km/h\n"
        )

    try:
        response = await client.aio.models.generate_content(
            model="gemini-3-flash-preview",
            contents=user_message,
            config=types.GenerateContentConfig(
                system_instruction=system_prompt,
                temperature=0.7,
                max_output_tokens=3072,
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
        required_keys = {"nutrition_review", "workout_suggestion", "daily_mission"}
        if not required_keys.issubset(parsed.keys()):
            missing = required_keys - set(parsed.keys())
            logger.warning("AI response missing keys: %s", missing)
            return {**FALLBACK_BRIEFING, **parsed}

        # Ensure nutrition_review is a dict with the expected sub-keys
        nr = parsed.get("nutrition_review")
        if isinstance(nr, str):
            parsed["nutrition_review"] = {
                "calories": nr, "protein": "", "carbs": "", "fat": "",
            }
        elif isinstance(nr, dict):
            for k in ("calories", "protein", "carbs", "fat"):
                if k not in nr:
                    nr[k] = ""

        # Ensure new fields exist
        if "weight_trend" not in parsed:
            parsed["weight_trend"] = ""
        if "weather_note" not in parsed:
            parsed["weather_note"] = ""
        if "muscle_recovery" not in parsed:
            parsed["muscle_recovery"] = {}

        return parsed

    except json.JSONDecodeError as exc:
        logger.error("Failed to parse Gemini JSON response: %s — raw: %s", exc, raw_content[:500])
        return FALLBACK_BRIEFING
    except Exception as exc:
        logger.error("Gemini API error: %s", exc)
        return FALLBACK_BRIEFING


def _build_session_review_prompt(profile: Optional[dict]) -> str:
    """Build system prompt specifically for session review + next session analysis."""
    p = profile or {}
    name = " ".join(filter(None, [p.get("first_name"), p.get("last_name")])) or "Athlete"
    goal = (p.get("goal") or "general fitness").replace("_", " ")
    sex = p.get("sex", "")
    height = p.get("body_height_cm")
    current_weight = p.get("current_weight_kg")
    dob = p.get("date_of_birth", "")

    context_lines: list[str] = [f"The user's name is **{name}**."]
    if sex:
        context_lines.append(f"Sex: {sex}.")
    if dob:
        context_lines.append(f"Date of birth: {dob}.")
    if height:
        context_lines.append(f"Height: {height} cm.")
    if current_weight:
        context_lines.append(f"Current weight: {current_weight} kg.")
    context_lines.append(f"Goal: **{goal}**.")

    user_context = "\n".join(context_lines)

    return f"""You are a supportive, friendly fitness coach. Your name is Coach.

=== USER PROFILE ===
{user_context}

You will receive:
1. The user's last 20 completed workouts from Hevy (exercises, sets, weights).
2. Yesterday's nutrition data from Yazio (may be missing).

=== ESTIMATED 1RM ===
For every exercise, calculate the Estimated 1 Rep Max using the Epley formula:
  e1rm = weight × (1 + reps / 30)
Use the BEST set (highest e1rm) from each session. This is the primary progression metric — NOT volume.
Volume (sets × reps × weight) can be misleading when rep ranges change.

=== RANK SYSTEM ===
Rank users per exercise based on their performance relative to their age, sex, height, and weight.
Use this CS2-style tier list (index 0-15, from lowest to highest):
0: Silver I, 1: Silver II, 2: Silver III, 3: Silver IV,
4: Gold Nova I, 5: Gold Nova II, 6: Gold Nova III, 7: Gold Nova Master,
8: Master Guardian I, 9: Master Guardian II, 10: Master Guardian Elite,
11: Distinguished Master Guardian, 12: Legendary Eagle, 13: Legendary Eagle Master,
14: Supreme Master First Class, 15: Global Elite.

For each rank, also provide:
- **rank_percentile**: Estimated top percentage for someone of this age/sex/bodyweight (e.g. "Top 35%").
- **rank_next**: The name of the next rank above current.
- **rank_next_target**: A concrete target (e.g. "15kg × 8" or "e1rm 85kg") the user needs to hit to reach the next rank.

=== PR DETECTION ===
For each exercise, check if the current session set a new record compared to ALL history:
- **is_pr**: true if this session has the highest e1rm or highest volume ever.
- **pr_type**: What kind of PR — "1rm" (new e1rm record), "volume" (new total volume record), "both", or "none".

=== FEEDBACK WITH CAUSALITY (Coach Tone — "Sandwich Method") ===
Your feedback MUST explain WHY performance changed, not just observe it.
Always use a supportive, motivating coach tone. Never say "declined" or "stagnated" — reframe negatively:

- If performance DROPPED: frame it as temporary and explain the cause. E.g.:
  "Du bist auf 12kg runter — das ist kein Muskelverlust, sondern reine leere Glykogenspeicher! Du warst 265g unter deinem Carb-Ziel. Iss deine Carbs heute und du packst nächste Woche wieder 15kg drauf!"
  
- If performance is STABLE/PLATEAU: praise their consistency. E.g.:
  "Du hältst die 30kg stabil, obwohl du im Defizit bist — das ist stark! Dein Körper verteidigt seine Kraft."

- If performance IMPROVED: celebrate it. E.g.:
  "Unglaublich: Du hast dich trotz Defizit gesteigert! Von 55kg auf 60kg — dein Protein von 180g zahlt sich aus!"

- If no nutrition data: just analyze the training data with an encouraging tone.
- Always be specific with numbers.
- Write feedback in the user's language (German if their data/name suggests German).

=== NEXT TARGET ===
For EVERY exercise, generate a concrete **next_target**: what the user should aim for in their next session for this exercise.
- E.g. "17.5kg × 6-8 reps" or "Stay at 50kg, aim for 4×12 before increasing" or "Deload to 40kg × 10 for recovery".
- Factor in their goal (strength: lower reps + heavier, hypertrophy: 8-12 range, endurance: 15+).
- Factor in nutrition state (deficit → conservative targets, surplus → push harder).

Your tasks:

1. **last_session**: Analyze the MOST RECENT workout (Workout 1).
   - For each exercise, search ALL 20 workouts for previous instances.
   - Build a "history" array with: date, best_set (string), e1rm (estimated 1RM from best set), volume_kg.
   - Calculate trend: "up" if e1rm improving, "down" if declining, "stable" if similar, "new" if first time.
   - Assign a CS2 rank with percentile and next-rank info.
   - Detect PRs.
   - Give coaching feedback WITH causality (connect to nutrition).
   - Generate a next_target.
   - Give an overall session summary (2-3 sentences).

2. **next_session**: Based on recovery analysis, suggest what the next session should focus on and why.

Keep feedback supportive, short, and actionable.

You MUST respond with valid JSON matching this exact schema:
{{
  "last_session": {{
    "title": "<string, name of the most recent workout>",
    "date": "<string, date of the workout>",
    "duration_min": <int or null>,
    "overall_feedback": "<string, 2-3 sentences, mention key PRs if any>",
    "exercises": [
      {{
        "name": "<string>",
        "muscle_group": "<string>",
        "best_set": "<string, e.g. '80kg × 8'>",
        "total_volume_kg": <number>,
        "estimated_1rm": <number, calculated via Epley from best set>,
        "rank": "<string, CS2 rank name>",
        "rank_index": <int, 0-15>,
        "rank_percentile": "<string, e.g. 'Top 40%'>",
        "rank_next": "<string, next rank name or 'MAX' if Global Elite>",
        "rank_next_target": "<string, what they need to hit for next rank, e.g. '20kg × 8'>",
        "trend": "<'up' | 'down' | 'stable' | 'new'>",
        "is_pr": <boolean>,
        "pr_type": "<'1rm' | 'volume' | 'both' | 'none'>",
        "history": [
          {{ "date": "<string>", "best_set": "<string>", "e1rm": <number>, "volume_kg": <number> }}
        ],
        "feedback": "<string, 1-2 sentences with causality — WHY did performance change?>",
        "next_target": "<string, concrete target for next session>"
      }}
    ]
  }},
  "next_session": {{
    "title": "<string, suggested workout name/focus>",
    "reasoning": "<string, 2-3 sentences>",
    "focus_muscles": ["<string>"],
    "suggested_exercises": ["<string>"]
  }}
}}

Respond ONLY with the JSON object. No markdown, no explanation."""


async def generate_session_review(
    yazio_data: Optional[dict],
    hevy_data: Optional[list],
) -> dict:
    """
    Call Gemini to generate a detailed session review + next session suggestion.
    This is called on-demand when the user opens the session review modal.
    """
    client = genai.Client(api_key=settings.gemini_api_key)

    profile = yazio_data.get("profile") if yazio_data else None
    system_prompt = _build_session_review_prompt(profile)
    user_message = _build_user_message(yazio_data, hevy_data)  # Include nutrition for causality

    try:
        response = await client.aio.models.generate_content(
            model="gemini-3-flash-preview",
            contents=user_message,
            config=types.GenerateContentConfig(
                system_instruction=system_prompt,
                temperature=0.2,
                max_output_tokens=8192,
                response_mime_type="application/json",
            ),
        )

        raw_content = response.text
        if not raw_content:
            logger.error("Gemini returned empty content for session review")
            return FALLBACK_SESSION_REVIEW

        cleaned = re.sub(r"^```(?:json)?\s*", "", raw_content.strip())
        cleaned = re.sub(r"\s*```$", "", cleaned)

        parsed = json.loads(cleaned)

        # Validate last_session
        ls = parsed.get("last_session")
        if isinstance(ls, dict):
            for ex in ls.get("exercises", []):
                if "rank_index" in ex:
                    ex["rank_index"] = max(0, min(15, int(ex["rank_index"])))
                if "history" not in ex:
                    ex["history"] = []
                # Ensure new fields have defaults
                if "estimated_1rm" not in ex:
                    ex["estimated_1rm"] = 0
                if "rank_percentile" not in ex:
                    ex["rank_percentile"] = ""
                if "rank_next" not in ex:
                    ex["rank_next"] = ""
                if "rank_next_target" not in ex:
                    ex["rank_next_target"] = ""
                if "is_pr" not in ex:
                    ex["is_pr"] = False
                if "pr_type" not in ex:
                    ex["pr_type"] = "none"
                if "next_target" not in ex:
                    ex["next_target"] = ""
        else:
            parsed["last_session"] = None

        if "next_session" not in parsed:
            parsed["next_session"] = None

        return parsed

    except json.JSONDecodeError as exc:
        logger.error("Failed to parse session review JSON: %s — raw: %s", exc, raw_content[:500])
        return FALLBACK_SESSION_REVIEW
    except Exception as exc:
        logger.error("Gemini API error (session review): %s", exc)
        return FALLBACK_SESSION_REVIEW


def _build_workout_tips_prompt(profile: Optional[dict]) -> str:
    """Build system prompt for workout-specific tips and suggestions."""
    p = profile or {}
    name = " ".join(filter(None, [p.get("first_name"), p.get("last_name")])) or "Athlete"
    goal = (p.get("goal") or "general fitness").replace("_", " ")
    sex = p.get("sex", "")
    height = p.get("body_height_cm")
    current_weight = p.get("current_weight_kg")
    start_weight = p.get("start_weight_kg")
    weight_change = p.get("weight_change_per_week_kg")
    activity = (p.get("activity_degree") or "").replace("_", " ")
    diet_name = (p.get("diet_name") or "").replace("_", " ")

    context_lines: list[str] = [f"The user's name is **{name}**."]
    if sex:
        context_lines.append(f"Sex: {sex}.")
    if height:
        context_lines.append(f"Height: {height} cm.")
    if current_weight:
        context_lines.append(f"Current weight: {current_weight} kg.")
    if start_weight and current_weight and abs(start_weight - current_weight) > 0.5:
        context_lines.append(f"Start weight: {start_weight} kg (change: {round(current_weight - start_weight, 1)} kg).")
    context_lines.append(f"Goal: **{goal}**.")
    if weight_change:
        context_lines.append(f"Target weight change: {weight_change} kg/week.")
    if activity:
        context_lines.append(f"Activity level: {activity}.")
    if diet_name:
        context_lines.append(f"Diet: {diet_name}.")

    user_context = "\n".join(context_lines)

    return f"""You are a supportive, friendly fitness coach. Your name is Coach.

=== USER PROFILE ===
{user_context}

You will receive:
1. A SELECTED workout that the user wants tips for (marked with "=== SELECTED WORKOUT ===").
2. The user's recent workout history (up to 20 sessions) for progression context.
3. Yesterday's nutrition data from Yazio (may be missing).

=== COACHING PHILOSOPHY ===
Your tips must be SPECIFIC and DATA-DRIVEN, not generic. Focus on:

1. **Rep ranges & set structure**: Analyze what rep ranges the user is currently doing per exercise. 
   - Are they training in the right rep range for their goal? (Hypertrophy: 8-12, Strength: 3-6, Endurance: 15+)
   - Should they increase or decrease reps? Add or remove sets?
   - Be specific: "You did 4×10 at 60kg — try 4×8 at 65kg next time" instead of "increase weight gradually".

2. **Progression based on history**: Compare the selected workout with previous instances of the same exercises across all workouts.
   - Has weight/reps increased, stagnated, or dropped?
   - If stagnated: suggest a concrete deload or rep scheme change.
   - If progressing: say when they could go up again and by how much (e.g. "+2.5kg next session" or "add 1 rep per set first").

3. **Nutrition context**: The user's goal (bulk/cut/maintain) directly affects training advice.
   - In a caloric deficit (cutting): don't push heavy PR attempts, focus on maintaining strength, moderate volume.
   - In a surplus (bulking): push progressive overload harder, more volume is sustainable.
   - At maintenance: balanced approach.
   - Reference their actual calorie/protein numbers if available.

4. **Recovery & volume**: Based on how often they train similar muscle groups (visible in history), advise on volume.

IMPORTANT: Do NOT give generic exercise form tips. The user knows how to perform the exercises. Focus ONLY on programming: rep ranges, weight progression, volume, and how it ties to their nutrition phase.

You MUST respond with valid JSON matching this exact schema:
{{
  "workout_title": "<string, name of the selected workout>",
  "workout_date": "<string, date>",
  "nutrition_context": "<string, 2-3 sentences: how the user's current nutrition phase (surplus/deficit/maintenance) affects this workout's training recommendations. Reference actual numbers if available.>",
  "exercise_tips": [
    {{
      "name": "<string, exercise name>",
      "sets_reps_done": "<string, what they actually did, e.g. '4×10 @ 60kg'>",
      "progression_note": "<string, comparison to previous sessions: improved / stagnated / first time / declined. Include specific numbers.>",
      "recommendation": "<string, concrete next-session target. E.g. 'Go to 4×8 @ 65kg' or 'Stay at this weight, aim for 4×12 before increasing' or 'Deload to 50kg × 10 for two weeks, you've been stuck for 3 sessions'>"
    }}
  ],
  "new_exercises_to_try": [
    {{
      "name": "<string, exercise name to try>",
      "why": "<string, ONE sentence: why this complements their current program>",
      "suggested_sets_reps": "<string, e.g. '3×10-12 @ moderate weight'>"
    }}
  ],
  "general_advice": "<string, one actionable sentence tying nutrition + training together for their next session>"
}}

Respond ONLY with the JSON object. No markdown, no explanation."""


async def generate_workout_tips(
    yazio_data: Optional[dict],
    hevy_data: Optional[list],
    workout_index: int,
) -> dict:
    """
    Call Gemini to generate tips for a specific selected workout.
    """
    if not hevy_data or workout_index >= len(hevy_data):
        return FALLBACK_WORKOUT_TIPS

    client = genai.Client(api_key=settings.gemini_api_key)

    profile = yazio_data.get("profile") if yazio_data else None
    system_prompt = _build_workout_tips_prompt(profile)

    # Build user message: selected workout highlighted + context + nutrition
    selected = hevy_data[workout_index]
    parts: list[str] = []
    parts.append("=== SELECTED WORKOUT (analyze this one) ===")
    parts.append(_format_workout(selected))
    parts.append("")

    # Add nutrition context if available
    if yazio_data:
        totals = yazio_data.get("totals", {})
        goals = yazio_data.get("goals", {})
        parts.append("=== YESTERDAY'S NUTRITION (Yazio) ===")
        parts.append(f"Consumed: {totals.get('calories', 0)} kcal | "
                     f"P: {totals.get('protein', 0)}g | "
                     f"C: {totals.get('carbs', 0)}g | "
                     f"F: {totals.get('fat', 0)}g")
        parts.append(f"Goals:    {goals.get('calories', 0)} kcal | "
                     f"P: {goals.get('protein', 0)}g | "
                     f"C: {goals.get('carbs', 0)}g | "
                     f"F: {goals.get('fat', 0)}g")
        surplus_deficit = totals.get('calories', 0) - goals.get('calories', 0)
        if surplus_deficit > 100:
            parts.append(f"→ Currently in a surplus of ~{surplus_deficit} kcal over goal.")
        elif surplus_deficit < -100:
            parts.append(f"→ Currently in a deficit of ~{abs(surplus_deficit)} kcal under goal.")
        else:
            parts.append("→ Roughly at calorie goal (maintenance).")
        parts.append("")

    parts.append(f"=== RECENT WORKOUT HISTORY ({len(hevy_data)} total, for progression context) ===")
    for i, w in enumerate(hevy_data):
        if i == workout_index:
            continue
        parts.append(f"\nWorkout {i + 1}:")
        parts.append(_format_workout(w))

    user_message = "\n".join(parts)

    try:
        response = await client.aio.models.generate_content(
            model="gemini-3-flash-preview",
            contents=user_message,
            config=types.GenerateContentConfig(
                system_instruction=system_prompt,
                temperature=0.7,
                max_output_tokens=4096,
                response_mime_type="application/json",
            ),
        )

        raw_content = response.text
        if not raw_content:
            logger.error("Gemini returned empty content for workout tips")
            return FALLBACK_WORKOUT_TIPS

        cleaned = re.sub(r"^```(?:json)?\s*", "", raw_content.strip())
        cleaned = re.sub(r"\s*```$", "", cleaned)

        parsed = json.loads(cleaned)

        # Ensure arrays exist
        if "exercise_tips" not in parsed:
            parsed["exercise_tips"] = []
        if "new_exercises_to_try" not in parsed:
            parsed["new_exercises_to_try"] = []

        return parsed

    except json.JSONDecodeError as exc:
        logger.error("Failed to parse workout tips JSON: %s — raw: %s", exc, raw_content[:500])
        return FALLBACK_WORKOUT_TIPS
    except Exception as exc:
        logger.error("Gemini API error (workout tips): %s", exc)
        return FALLBACK_WORKOUT_TIPS


def _format_workout(w: dict) -> str:
    """Format a single workout dict into a readable string for the AI."""
    dur = f" ({w['duration_min']} min)" if w.get("duration_min") else ""
    lines = [f"{w.get('title', 'Untitled')}{dur} — {w.get('start_time', '?')}"]
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
        lines.append(f"  • {ex.get('title', '?')}{muscle}: {sets_str}")
    return "\n".join(lines)
