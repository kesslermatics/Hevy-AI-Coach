"""
Yazio API Test Script
=====================
Tests the undocumented Yazio API by logging in and fetching today's nutritional summary.

Usage:
  1. Fill in YAZIO_EMAIL and YAZIO_PASSWORD in the .env file
  2. Run:  python test_yazio.py
"""

import asyncio
import os
from datetime import date, timedelta

import httpx
from dotenv import load_dotenv

load_dotenv()

# ── Yazio API Constants ─────────────────────────────────────
YAZIO_BASE_URL = "https://yzapi.yazio.com/v15"
YAZIO_CLIENT_ID = "1_4hiybetvfksgw40o0sog4s884kwc840wwso8go4k8c04goo4c"
YAZIO_CLIENT_SECRET = "6rok2m65xuskgkgogw40wkkk8sw0osg84s8cggsc4woos4s8o"


async def yazio_login(client: httpx.AsyncClient, email: str, password: str) -> str:
    """
    Authenticate with the Yazio API and return the access token.
    """
    payload = {
        "client_id": YAZIO_CLIENT_ID,
        "client_secret": YAZIO_CLIENT_SECRET,
        "username": email,
        "password": password,
        "grant_type": "password",
    }

    response = await client.post(f"{YAZIO_BASE_URL}/oauth/token", json=payload)

    if response.status_code != 200:
        print(f"❌ Login failed (HTTP {response.status_code})")
        print(f"   Response: {response.text}")
        raise SystemExit(1)

    data = response.json()
    token = data.get("access_token")
    if not token:
        print("❌ No access_token in response:")
        print(f"   {data}")
        raise SystemExit(1)

    return token


async def get_daily_summary(client: httpx.AsyncClient, token: str, target_date: str) -> dict:
    """
    Fetch the daily nutritional summary for a given date.
    """
    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/json",
    }
    params = {"date": target_date}

    response = await client.get(
        f"{YAZIO_BASE_URL}/user/widgets/daily-summary",
        headers=headers,
        params=params,
    )

    if response.status_code != 200:
        print(f"❌ Failed to fetch daily summary (HTTP {response.status_code})")
        print(f"   Response: {response.text}")
        raise SystemExit(1)

    return response.json()


def extract_and_print(data: dict, target_date: str) -> None:
    """
    Extract and display the key nutritional data from the daily summary.
    """
    print(f"\n{'═' * 50}")
    print(f"  🍽️  YAZIO Daily Summary — {target_date}")
    print(f"{'═' * 50}\n")

    try:
        meals = data.get("meals", {})
        goals = data.get("goals", {})
        user_info = data.get("user", {})

        # Sum up all meals
        total_cal = 0.0
        total_protein = 0.0
        total_carbs = 0.0
        total_fat = 0.0

        meal_labels = {
            "breakfast": "🌅 Breakfast",
            "lunch":     "☀️  Lunch",
            "dinner":    "🌙 Dinner",
            "snack":     "🍫 Snacks",
        }

        for meal_key, label in meal_labels.items():
            meal = meals.get(meal_key, {})
            nutrients = meal.get("nutrients", {})
            cal  = nutrients.get("energy.energy", 0)
            prot = nutrients.get("nutrient.protein", 0)
            carb = nutrients.get("nutrient.carb", 0)
            fat  = nutrients.get("nutrient.fat", 0)

            total_cal += cal
            total_protein += prot
            total_carbs += carb
            total_fat += fat

            if cal > 0:
                print(f"  {label:<16} {cal:>7.0f} kcal  |  P: {prot:>5.1f}g  C: {carb:>5.1f}g  F: {fat:>5.1f}g")

        goal_cal  = goals.get("energy.energy", 0)
        goal_prot = goals.get("nutrient.protein", 0)
        goal_carb = goals.get("nutrient.carb", 0)
        goal_fat  = goals.get("nutrient.fat", 0)

        print(f"\n  {'─' * 46}")
        print(f"  🔥 Total Calories:      {total_cal:>7.0f} / {goal_cal:.0f} kcal")
        print(f"  🥩 Protein:             {total_protein:>7.1f} / {goal_prot:.0f} g")
        print(f"  🍞 Carbohydrates:       {total_carbs:>7.1f} / {goal_carb:.0f} g")
        print(f"  🧈 Fat:                 {total_fat:>7.1f} / {goal_fat:.0f} g")

        remaining = goal_cal - total_cal
        print(f"\n  {'🟢' if remaining >= 0 else '🔴'} Remaining:            {remaining:>7.0f} kcal")

        # User info
        if user_info:
            print(f"\n  👤 Goal: {user_info.get('goal', 'N/A').replace('_', ' ').title()}")
            print(f"  ⚖️  Weight: {user_info.get('current_weight', '?')} kg (started at {user_info.get('start_weight', '?')} kg)")

        # Activity
        steps = data.get("steps", 0)
        activity_energy = data.get("activity_energy", 0)
        if steps or activity_energy:
            print(f"\n  🚶 Steps: {steps:,}  |  🔥 Activity burn: {activity_energy:.0f} kcal")

    except Exception as e:
        print(f"  ⚠️  Error extracting data: {e}")
        import json
        print(json.dumps(data, indent=2, default=str)[:3000])

    print(f"\n{'═' * 50}\n")


async def main():
    email = os.getenv("YAZIO_EMAIL", "")
    password = os.getenv("YAZIO_PASSWORD", "")

    if not email or email == "your-yazio-email@example.com":
        print("❌ Please set YAZIO_EMAIL in your .env file")
        raise SystemExit(1)
    if not password or password == "your-yazio-password":
        print("❌ Please set YAZIO_PASSWORD in your .env file")
        raise SystemExit(1)

    today = date.today().isoformat()  # YYYY-MM-DD

    print(f"🔑  Logging into Yazio as {email}...")

    async with httpx.AsyncClient(timeout=30.0) as client:
        # Step 1: Login
        token = await yazio_login(client, email, password)
        print(f"✅  Login successful! Token: {token[:20]}...")

        # Step 2: Fetch daily summary
        print(f"📊  Fetching daily summary for {today}...")
        summary = await get_daily_summary(client, token, today)

        # Step 3: Display results
        extract_and_print(summary, today)


if __name__ == "__main__":
    asyncio.run(main())
