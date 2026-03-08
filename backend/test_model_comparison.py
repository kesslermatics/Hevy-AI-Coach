"""
Test script: Compare workout tips quality between Gemini models.
Generates tips for "Sa - Kings With Wings" using:
  1) gemini-3-flash-preview  (current production model)
  2) gemini-3.1-pro-preview  (potential upgrade)

Saves results to:
  - test_tips_flash.json
  - test_tips_pro.json
"""
import asyncio
import json
import re
import time

from google import genai
from google.genai import types

# ── Bootstrap ────────────────────────────────────────────────────────
from app.config import settings
from app.database import SessionLocal
from app.models import User, WorkoutReview
from app.encryption import decrypt_value
from app.services.hevy_service import fetch_recent_workouts, fetch_routines
from app.services.yazio_service import fetch_yazio_summary
from app.services.ai_service import (
    _build_workout_tips_prompt,
    _format_workout,
    _format_coaching_memory,
)

WORKOUT_NAME = "Sa - Kings With Wings"
MODELS = [
    ("gemini-3-flash-preview", "test_tips_flash.json"),
    ("gemini-3.1-pro-preview", "test_tips_pro.json"),
]


async def gather_real_data():
    """Fetch real user data from DB + APIs (same as production flow)."""
    db = SessionLocal()
    user = None
    for u in db.query(User).all():
        if u.hevy_api_key:
            user = u
            break
    if not user:
        raise RuntimeError("No user with Hevy API key found")

    api_key = decrypt_value(user.hevy_api_key)

    # Fetch workouts (last 20)
    print("⏳ Fetching recent workouts from Hevy...")
    hevy_data = await fetch_recent_workouts(api_key, count=20) or []
    print(f"   → {len(hevy_data)} workouts fetched")

    # Fetch routine templates
    print("⏳ Fetching routine templates from Hevy...")
    routines = await fetch_routines(api_key) or []
    routine_exercises = None
    for r in routines:
        if r.get("title", "").strip().lower() == WORKOUT_NAME.strip().lower():
            routine_exercises = r.get("exercises", [])
            print(f"   → Found routine '{r['title']}' with {len(routine_exercises)} exercises")
            break
    if not routine_exercises:
        print("   ⚠️  No matching routine template found, will use most recent session")

    # Fetch Yazio nutrition
    yazio_data = None
    if user.yazio_email and user.yazio_password:
        print("⏳ Fetching nutrition from Yazio...")
        try:
            email = decrypt_value(user.yazio_email)
            password = decrypt_value(user.yazio_password)
            yazio_data = await fetch_yazio_summary(email, password)
            if yazio_data:
                t = yazio_data.get("totals", {})
                print(f"   → {t.get('calories', 0)} kcal, {t.get('protein', 0)}g protein")
        except Exception as exc:
            print(f"   ⚠️  Yazio failed: {exc}")

    # Previous coaching memory
    previous_reviews = (
        db.query(WorkoutReview)
        .filter(
            WorkoutReview.user_id == user.id,
            WorkoutReview.workout_name == WORKOUT_NAME,
        )
        .order_by(WorkoutReview.workout_date.desc())
        .limit(3)
        .all()
    )
    previous_tips_list = [r.tips_data for r in previous_reviews if r.tips_data]
    print(f"   → {len(previous_tips_list)} previous coaching memories loaded")

    db.close()
    return hevy_data, routine_exercises, yazio_data, previous_tips_list, user.language or "de"


def build_prompt(hevy_data, routine_exercises, yazio_data, previous_tips_list, language):
    """Build the exact same prompt as production generate_workout_tips()."""
    workout_name = WORKOUT_NAME

    matching_sessions = [
        w for w in (hevy_data or [])
        if w.get("title", "").strip().lower() == workout_name.strip().lower()
    ]

    if routine_exercises:
        full_template_exercises = routine_exercises
        exercise_source = "routine template"

        # Merge notes from latest workout into routine template
        if matching_sessions:
            latest_session = matching_sessions[0]
            workout_notes: dict[str, str] = {}
            for ex in latest_session.get("exercises", []):
                note = ex.get("notes") or ex.get("note") or ""
                if note:
                    workout_notes[ex.get("title", "").strip().lower()] = note
            if workout_notes:
                for ex in full_template_exercises:
                    ex_key = ex.get("title", "").strip().lower()
                    if ex_key in workout_notes and not ex.get("notes"):
                        ex["notes"] = workout_notes[ex_key]
    else:
        selected = matching_sessions[0] if matching_sessions else {"title": workout_name, "exercises": [], "start_time": ""}
        full_template_exercises = selected.get("exercises", [])
        exercise_source = "most recent session"

    profile = yazio_data.get("profile") if yazio_data else None
    system_prompt = _build_workout_tips_prompt(profile, lang=language)

    # Build user message
    parts: list[str] = []
    parts.append(f"=== PLANNED WORKOUT (generate targets for ALL exercises listed below) ===")
    parts.append(f"Workout name: {workout_name}")
    if full_template_exercises:
        parts.append(f"Full exercise list for this workout ({len(full_template_exercises)} exercises from {exercise_source}):")
        for ex in full_template_exercises:
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
            note_str = f"  📝 Note: {ex['notes']}" if ex.get("notes") else ""
            parts.append(f"  • {ex.get('title', '?')}{muscle}: {sets_str}{note_str}")
    parts.append("")
    parts.append("IMPORTANT: You MUST generate targets for EVERY exercise listed above. Do not skip any.")
    parts.append("IMPORTANT: If an exercise has a 📝 Note listing available weights, you MUST ONLY use weights from that exact list. Never suggest weights not in the list.")
    parts.append("")

    if yazio_data:
        totals = yazio_data.get("totals", {})
        goals = yazio_data.get("goals", {})
        cal_in = round(totals.get('calories', 0))
        prot_in = round(totals.get('protein', 0))
        carb_in = round(totals.get('carbs', 0))
        fat_in = round(totals.get('fat', 0))
        cal_goal = round(goals.get('calories', 0))
        prot_goal = round(goals.get('protein', 0))
        parts.append("=== YESTERDAY'S NUTRITION ===")
        parts.append(f"Eaten: {cal_in} kcal (P:{prot_in}g C:{carb_in}g F:{fat_in}g) | Goal: {cal_goal} kcal, P:{prot_goal}g")
        surplus_deficit = cal_in - cal_goal
        if surplus_deficit > 100:
            parts.append(f"→ Surplus ~{surplus_deficit} kcal.")
        elif surplus_deficit < -100:
            parts.append(f"→ Deficit ~{abs(surplus_deficit)} kcal.")
        else:
            parts.append("→ At maintenance.")
        parts.append("")

    # Only include sessions of the SAME workout type (max 3), filtered to template exercises
    template_names = {ex.get("title", "").strip().lower() for ex in full_template_exercises} if full_template_exercises else set()
    relevant_history = matching_sessions[:3]
    if relevant_history:
        parts.append(f"=== RECENT SESSIONS OF '{workout_name}' ({len(relevant_history)} of {len(matching_sessions)} total) ===")
        for i, w in enumerate(relevant_history):
            filtered_w = dict(w)
            if template_names:
                filtered_w["exercises"] = [
                    ex for ex in w.get("exercises", [])
                    if ex.get("title", "").strip().lower() in template_names
                ]
            parts.append(f"\nSession {i + 1} ({w.get('start_time', 'unknown date')[:10]}):")
            parts.append(_format_workout(filtered_w))
    else:
        parts.append(f"=== NO PREVIOUS SESSIONS of '{workout_name}' found — first time ===")

    user_message = "\n".join(parts)

    if previous_tips_list:
        user_message += _format_coaching_memory(previous_tips_list, memory_type="workout_tips")

    return system_prompt, user_message


async def generate_with_model(model_name, system_prompt, user_message):
    """Call Gemini with the given model and return parsed JSON + timing."""
    client = genai.Client(api_key=settings.gemini_api_key)

    start = time.time()
    response = await client.aio.models.generate_content(
        model=model_name,
        contents=user_message,
        config=types.GenerateContentConfig(
            system_instruction=system_prompt,
            temperature=0.7,
            max_output_tokens=8192,
            response_mime_type="application/json",
        ),
    )
    elapsed = time.time() - start

    raw = response.text or ""
    cleaned = re.sub(r"^```(?:json)?\s*", "", raw.strip())
    cleaned = re.sub(r"\s*```$", "", cleaned)

    try:
        parsed = json.loads(cleaned)
    except json.JSONDecodeError:
        parsed = {"_raw_response": raw, "_parse_error": True}

    return parsed, elapsed, raw


async def main():
    print("=" * 60)
    print(f"MODEL COMPARISON TEST — Workout: {WORKOUT_NAME}")
    print("=" * 60)
    print()

    # Gather real data (once, shared by both models)
    hevy_data, routine_exercises, yazio_data, previous_tips_list, language = await gather_real_data()

    # Build prompt (identical for both)
    system_prompt, user_message = build_prompt(
        hevy_data, routine_exercises, yazio_data, previous_tips_list, language
    )

    # Print prompt stats
    print(f"\n📊 Prompt stats:")
    print(f"   System prompt: {len(system_prompt)} chars")
    print(f"   User message:  {len(user_message)} chars")
    print(f"   Exercises in template: {sum(1 for line in user_message.split(chr(10)) if line.strip().startswith('•'))}")
    print()

    # Save the prompt for reference
    with open("test_prompt.txt", "w", encoding="utf-8") as f:
        f.write("=== SYSTEM PROMPT ===\n")
        f.write(system_prompt)
        f.write("\n\n=== USER MESSAGE ===\n")
        f.write(user_message)
    print("💾 Full prompt saved to test_prompt.txt\n")

    # Generate with each model
    for model_name, output_file in MODELS:
        print(f"🤖 Generating with {model_name}...")
        try:
            parsed, elapsed, raw = await generate_with_model(model_name, system_prompt, user_message)

            # Save output
            output = {
                "_meta": {
                    "model": model_name,
                    "elapsed_seconds": round(elapsed, 2),
                    "workout_name": WORKOUT_NAME,
                },
                **parsed,
            }
            with open(output_file, "w", encoding="utf-8") as f:
                json.dump(output, f, indent=2, ensure_ascii=False)

            # Print summary
            targets = parsed.get("exercise_targets", [])
            print(f"   ✅ Done in {elapsed:.1f}s — {len(targets)} exercise targets")
            for t in targets:
                sets = t.get("set_targets", [])
                weights = [s.get("weight_kg") for s in sets if s.get("weight_kg") is not None]
                print(f"      • {t.get('name', '?')}: {len(sets)} sets, weights={weights}")
                # Check for the Cable Row note compliance
                if "cable row" in t.get("name", "").lower():
                    valid_weights = {5, 12, 19, 26, 33, 40, 47, 57, 67, 77, 87}
                    bad = [w for w in weights if w not in valid_weights]
                    if bad:
                        print(f"         ❌ INVALID WEIGHTS (not in note list): {bad}")
                    else:
                        print(f"         ✅ All weights comply with note constraints")
            print(f"   💾 Saved to {output_file}")

        except Exception as exc:
            print(f"   ❌ FAILED: {exc}")

        print()


if __name__ == "__main__":
    asyncio.run(main())
