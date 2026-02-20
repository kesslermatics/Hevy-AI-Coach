"""
Manual Briefing Test
====================
Triggers the full briefing pipeline for a given user:
  1. Fetches Yazio nutrition (yesterday)
  2. Fetches Hevy workouts (last 5)
  3. Calls Gemini to generate the briefing
  4. Prints the result (does NOT save to DB)

Usage:
  cd backend
  ./venv/bin/python -u test_briefing.py [username]

If no username is given, uses the first user with active credentials.
"""
import asyncio
import json
import sys

from app.database import SessionLocal
from app.models import User
from app.services.aggregator import gather_user_context
from app.services.ai_service import generate_daily_briefing
from app.encryption import decrypt_value


async def main():
    db = SessionLocal()

    try:
        # Find user
        username = sys.argv[1] if len(sys.argv) > 1 else None

        if username:
            user = db.query(User).filter(User.username == username).first()
            if not user:
                print(f"❌ User '{username}' not found")
                return
        else:
            # First user with both credentials
            user = (
                db.query(User)
                .filter(
                    User.hevy_api_key.isnot(None),
                    User.yazio_email.isnot(None),
                )
                .first()
            )
            if not user:
                print("❌ No user with active Hevy + Yazio credentials found")
                return

        print(f"👤 User: {user.username} (id: {user.id})")
        print(f"   Goal: {user.current_goal or 'Not set'}")
        print(f"   Target weight: {user.target_weight or 'Not set'}")
        print(f"   Hevy key: {'✅' if user.hevy_api_key else '❌'}")
        print(f"   Yazio:    {'✅' if user.yazio_email else '❌'}")
        print()

        # Step 1: Gather data
        print("📡 Gathering data from Yazio + Hevy...")
        context = await gather_user_context(user)

        yazio = context["yazio"]
        hevy = context["hevy"]

        if yazio:
            totals = yazio.get("totals", {})
            print(f"   🍽️  Yazio: {totals.get('calories', 0)} kcal | "
                  f"P: {totals.get('protein', 0)}g | "
                  f"C: {totals.get('carbs', 0)}g | "
                  f"F: {totals.get('fat', 0)}g")
        else:
            print("   🍽️  Yazio: No data")

        if hevy:
            print(f"   🏋️  Hevy: {len(hevy)} workouts fetched")
            for i, w in enumerate(hevy, 1):
                exercises = [ex.get("title", "?") for ex in w.get("exercises", [])]
                print(f"      {i}. {w.get('title', '?')} — {', '.join(exercises[:4])}")
        else:
            print("   🏋️  Hevy: No data")

        print()

        # Step 2: Generate briefing
        print("🤖 Calling Gemini (gemini-3-flash-preview)...")
        briefing = await generate_daily_briefing(
            yazio_data=yazio,
            hevy_data=hevy,
        )

        print()
        print("═" * 55)
        print("  🌅  DAILY MORNING BRIEFING")
        print("═" * 55)

        # Nutrition Review
        nr = briefing.get("nutrition_review", {})
        if isinstance(nr, dict):
            print()
            print(f"  � Calories: {nr.get('calories', 'N/A')}")
            print(f"  🥩 Protein:  {nr.get('protein', 'N/A')}")
            print(f"  🌾 Carbs:    {nr.get('carbs', 'N/A')}")
            print(f"  💧 Fat:      {nr.get('fat', 'N/A')}")
        else:
            print(f"\n  🍽️  Nutrition: {nr}")

        print(f"\n  🏋️  Workout Suggestion:")
        print(f"     {briefing.get('workout_suggestion', 'N/A')}")

        print(f"\n  🎯 Daily Mission:")
        print(f"     {briefing.get('daily_mission', 'N/A')}")

        # Last Session
        ls = briefing.get("last_session")
        if ls:
            print(f"\n  🏆 Last Session: {ls.get('title', '?')} ({ls.get('date', '?')})")
            print(f"     {ls.get('overall_feedback', '')}")
            for ex in ls.get("exercises", []):
                trend_icon = {"up": "↑", "down": "↓", "stable": "→", "new": "✨"}.get(ex.get("trend", ""), "?")
                print(f"     • {ex.get('name', '?')} [{ex.get('rank', '?')}] {trend_icon} "
                      f"— Best: {ex.get('best_set', '?')} | Vol: {ex.get('total_volume_kg', 0)} kg")
                print(f"       {ex.get('feedback', '')}")

        # Next Session
        ns = briefing.get("next_session")
        if ns:
            print(f"\n  🎯 Next Session: {ns.get('title', '?')}")
            print(f"     {ns.get('reasoning', '')}")
            print(f"     Focus: {', '.join(ns.get('focus_muscles', []))}")
            print(f"     Exercises: {', '.join(ns.get('suggested_exercises', []))}")

        print()
        print("═" * 55)
        print()
        print("📋 Raw JSON:")
        print(json.dumps(briefing, indent=2, ensure_ascii=False))

    finally:
        db.close()


if __name__ == "__main__":
    asyncio.run(main())
