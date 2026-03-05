"""
Comprehensive Yazio API endpoint brute-force probe.
Systematically discovers all available endpoints on the undocumented Yazio v15 API.

Usage:
  1. Set YAZIO_EMAIL and YAZIO_PASSWORD in .env
  2. Run:  python probe_yazio_endpoints.py
"""
import asyncio
import os
import json
from datetime import date, timedelta
from typing import Optional

import httpx
from dotenv import load_dotenv

load_dotenv()

YAZIO_BASE_URL = "https://yzapi.yazio.com/v15"
YAZIO_CLIENT_ID = "1_4hiybetvfksgw40o0sog4s884kwc840wwso8go4k8c04goo4c"
YAZIO_CLIENT_SECRET = "6rok2m65xuskgkgogw40wkkk8sw0osg84s8cggsc4woos4s8o"

TODAY = date.today()
YESTERDAY = TODAY - timedelta(days=1)
WEEK_AGO = TODAY - timedelta(days=7)
MONTH_AGO = TODAY - timedelta(days=30)

# Color helpers
GREEN = "\033[92m"
RED = "\033[91m"
YELLOW = "\033[93m"
CYAN = "\033[96m"
BOLD = "\033[1m"
RESET = "\033[0m"

RESULTS: dict[str, dict] = {}


async def login(client: httpx.AsyncClient) -> str:
    email = os.getenv("YAZIO_EMAIL")
    password = os.getenv("YAZIO_PASSWORD")
    if not email or not password:
        print(f"{RED}Set YAZIO_EMAIL and YAZIO_PASSWORD in .env{RESET}")
        raise SystemExit(1)

    r = await client.post(f"{YAZIO_BASE_URL}/oauth/token", json={
        "client_id": YAZIO_CLIENT_ID,
        "client_secret": YAZIO_CLIENT_SECRET,
        "username": email,
        "password": password,
        "grant_type": "password",
    })
    if r.status_code != 200:
        print(f"{RED}Login failed: {r.status_code} {r.text[:200]}{RESET}")
        raise SystemExit(1)

    data = r.json()
    print(f"{GREEN}Login successful!{RESET}")
    print(f"  Token type: {data.get('token_type')}")
    print(f"  Expires in: {data.get('expires_in')}s")
    print(f"  Scope: {data.get('scope')}")
    print(f"  Refresh token present: {bool(data.get('refresh_token'))}")
    return data["access_token"]


async def probe(client: httpx.AsyncClient, headers: dict, method: str, path: str,
                params: Optional[dict] = None, json_body: Optional[dict] = None,
                label: str = "") -> Optional[dict]:
    """Probe a single endpoint and record the result."""
    url = f"{YAZIO_BASE_URL}{path}"
    display = f"{method} {path}"
    if params:
        display += f"  params={params}"
    if label:
        display = f"[{label}] {display}"

    try:
        if method == "GET":
            r = await client.get(url, headers=headers, params=params)
        elif method == "POST":
            r = await client.post(url, headers=headers, json=json_body or {}, params=params)
        elif method == "PUT":
            r = await client.put(url, headers=headers, json=json_body or {}, params=params)
        elif method == "DELETE":
            # Don't actually delete, just check if the route exists via OPTIONS or skip
            r = await client.request("OPTIONS", url, headers=headers)
        elif method == "OPTIONS":
            r = await client.request("OPTIONS", url, headers=headers)
        else:
            return None

        if r.status_code in (200, 201):
            try:
                data = r.json()
            except Exception:
                data = {"_raw_text": r.text[:2000]}

            text = json.dumps(data, indent=2, default=str)
            truncated = text[:3000]
            print(f"\n{GREEN}{BOLD}✅ {display} → {r.status_code}{RESET}")
            print(truncated)
            if len(text) > 3000:
                print(f"  ... ({len(text)} chars total)")

            RESULTS[f"{method} {path}"] = {
                "status": r.status_code,
                "params": params,
                "label": label,
                "data_preview": text[:5000],
                "data_keys": list(data.keys()) if isinstance(data, dict) else f"list[{len(data)}]" if isinstance(data, list) else str(type(data)),
            }
            return data
        elif r.status_code in (401, 403):
            print(f"  {YELLOW}🔒 {display} → {r.status_code} (auth issue){RESET}")
        elif r.status_code == 404:
            pass  # silently skip 404s
        elif r.status_code == 405:
            pass  # method not allowed, skip
        else:
            print(f"  {RED}❌ {display} → {r.status_code}: {r.text[:150]}{RESET}")

    except Exception as e:
        print(f"  {RED}❌ {display} → ERROR: {e}{RESET}")

    return None


async def main():
    async with httpx.AsyncClient(timeout=30.0) as client:
        token = await login(client)
        headers = {"Authorization": f"Bearer {token}", "Accept": "application/json"}

        print(f"\n{'='*70}")
        print(f"{BOLD}{CYAN}PHASE 1: Core User Endpoints{RESET}")
        print(f"{'='*70}")

        # ── User profile & settings ──
        for ep in [
            "/user",
            "/user/settings",
            "/user/preferences",
            "/user/subscription",
            "/user/premium",
            "/user/goals",
            "/user/diet",
            "/user/avatar",
            "/user/notifications",
            "/user/devices",
            "/user/integrations",
            "/user/connected-apps",
            "/user/connections",
        ]:
            await probe(client, headers, "GET", ep, label="Profile")

        print(f"\n{'='*70}")
        print(f"{BOLD}{CYAN}PHASE 2: Widgets (like daily-summary){RESET}")
        print(f"{'='*70}")

        # ── Widgets ──
        widget_names = [
            "daily-summary",
            "overview",
            "progress",
            "weight",
            "weight-history",
            "body-data",
            "body-weight",
            "body",
            "nutrition",
            "nutrition-summary",
            "food-diary",
            "diary",
            "meals",
            "meal-summary",
            "water",
            "water-intake",
            "steps",
            "activity",
            "activity-summary",
            "calories",
            "calories-summary",
            "macros",
            "macro-summary",
            "nutrients",
            "nutrient-summary",
            "health",
            "fasting",
            "fasting-timer",
            "recipes",
            "goals",
            "streaks",
            "challenges",
            "achievements",
            "statistics",
            "stats",
            "weekly-summary",
            "monthly-summary",
        ]
        for w in widget_names:
            await probe(client, headers, "GET", f"/user/widgets/{w}",
                        params={"date": YESTERDAY.isoformat()}, label="Widget")

        # Some widgets might not need a date param
        for w in ["overview", "progress", "fasting", "streaks", "goals", "statistics", "stats"]:
            await probe(client, headers, "GET", f"/user/widgets/{w}", label="Widget(no date)")

        print(f"\n{'='*70}")
        print(f"{BOLD}{CYAN}PHASE 3: Diary / Meal items / Food logging{RESET}")
        print(f"{'='*70}")

        # ── This is the KEY area: individual food items ──
        diary_endpoints = [
            # Standard diary
            "/user/diary",
            "/user/diary/items",
            "/user/diary/entries",
            "/user/diary/foods",
            "/user/diary/meals",
            # Per meal type
            "/user/diary/breakfast",
            "/user/diary/lunch",
            "/user/diary/dinner",
            "/user/diary/snack",
            # Food log
            "/user/food-log",
            "/user/food-diary",
            "/user/food-entries",
            "/user/food-items",
            "/user/foods",
            "/user/meals",
            "/user/meal-items",
            "/user/meal-entries",
            "/user/meal-logs",
            # Consumed items
            "/user/consumed",
            "/user/consumed-items",
            "/user/consumed-foods",
            "/user/consumption",
            # Items
            "/user/items",
            "/user/entries",
            "/user/logged-items",
            "/user/logged-foods",
            "/user/tracking",
            "/user/tracking/food",
            "/user/tracking/nutrition",
            "/user/tracking/meals",
            # Nutrition
            "/user/nutrition",
            "/user/nutrition/diary",
            "/user/nutrition/items",
            "/user/nutrition/entries",
            "/user/nutrition/log",
        ]

        for ep in diary_endpoints:
            # Try without params first
            await probe(client, headers, "GET", ep, label="Diary")
            # Then with date
            await probe(client, headers, "GET", ep,
                        params={"date": YESTERDAY.isoformat()}, label="Diary+date")

        # Try date ranges
        range_endpoints = [
            "/user/diary",
            "/user/food-log",
            "/user/consumed",
            "/user/entries",
            "/user/nutrition",
            "/user/meals",
        ]
        for ep in range_endpoints:
            await probe(client, headers, "GET", ep, params={
                "from": WEEK_AGO.isoformat(),
                "to": TODAY.isoformat(),
            }, label="Diary+range")
            await probe(client, headers, "GET", ep, params={
                "start_date": WEEK_AGO.isoformat(),
                "end_date": TODAY.isoformat(),
            }, label="Diary+range2")

        print(f"\n{'='*70}")
        print(f"{BOLD}{CYAN}PHASE 4: Body data / Weight / Measurements{RESET}")
        print(f"{'='*70}")

        body_endpoints = [
            "/user/body-data",
            "/user/body-entries",
            "/user/body",
            "/user/body/weight",
            "/user/body/measurements",
            "/user/body-weight",
            "/user/body-weights",
            "/user/body-measurements",
            "/user/weights",
            "/user/weight",
            "/user/weight-history",
            "/user/weight-entries",
            "/user/measurements",
            "/user/body-log",
            "/user/body-logs",
        ]
        for ep in body_endpoints:
            await probe(client, headers, "GET", ep, label="Body")
            await probe(client, headers, "GET", ep, params={
                "from": MONTH_AGO.isoformat(),
                "to": TODAY.isoformat(),
            }, label="Body+range")

        print(f"\n{'='*70}")
        print(f"{BOLD}{CYAN}PHASE 5: Products / Food database / Search{RESET}")
        print(f"{'='*70}")

        product_endpoints = [
            "/products",
            "/products/search",
            "/foods",
            "/foods/search",
            "/food/search",
            "/recipes",
            "/recipes/search",
            "/search",
            "/search/products",
            "/search/foods",
            "/user/products",
            "/user/recipes",
            "/user/favorites",
            "/user/favorite-products",
            "/user/favorite-foods",
            "/user/recent",
            "/user/recent-products",
            "/user/recent-foods",
            "/user/custom-products",
            "/user/custom-foods",
            "/user/created-products",
        ]

        for ep in product_endpoints:
            await probe(client, headers, "GET", ep, label="Products")

        # Search with query
        for ep in ["/products/search", "/foods/search", "/search", "/search/products", "/search/foods"]:
            await probe(client, headers, "GET", ep, params={"q": "banana"}, label="Search")
            await probe(client, headers, "GET", ep, params={"query": "banana"}, label="Search")
            await probe(client, headers, "GET", ep, params={"term": "banana"}, label="Search")

        print(f"\n{'='*70}")
        print(f"{BOLD}{CYAN}PHASE 6: Water tracking{RESET}")
        print(f"{'='*70}")

        water_endpoints = [
            "/user/water",
            "/user/water-intake",
            "/user/water-log",
            "/user/water-entries",
            "/user/hydration",
        ]
        for ep in water_endpoints:
            await probe(client, headers, "GET", ep, label="Water")
            await probe(client, headers, "GET", ep,
                        params={"date": YESTERDAY.isoformat()}, label="Water+date")

        print(f"\n{'='*70}")
        print(f"{BOLD}{CYAN}PHASE 7: Activity / Steps / Exercise{RESET}")
        print(f"{'='*70}")

        activity_endpoints = [
            "/user/activities",
            "/user/activity",
            "/user/activity-log",
            "/user/activity-entries",
            "/user/exercises",
            "/user/exercise-log",
            "/user/steps",
            "/user/step-history",
            "/user/workouts",
            "/user/sports",
            "/user/sports-activities",
            "/user/burned-calories",
        ]
        for ep in activity_endpoints:
            await probe(client, headers, "GET", ep, label="Activity")
            await probe(client, headers, "GET", ep,
                        params={"date": YESTERDAY.isoformat()}, label="Activity+date")

        print(f"\n{'='*70}")
        print(f"{BOLD}{CYAN}PHASE 8: Fasting{RESET}")
        print(f"{'='*70}")

        fasting_endpoints = [
            "/user/fasting",
            "/user/fasting/current",
            "/user/fasting/history",
            "/user/fasting/timer",
            "/user/fasting/plan",
            "/user/fasting/entries",
            "/user/fasting/stats",
        ]
        for ep in fasting_endpoints:
            await probe(client, headers, "GET", ep, label="Fasting")

        print(f"\n{'='*70}")
        print(f"{BOLD}{CYAN}PHASE 9: Goals / Plans / Challenges{RESET}")
        print(f"{'='*70}")

        goal_endpoints = [
            "/user/goals",
            "/user/goal",
            "/user/plans",
            "/user/plan",
            "/user/challenges",
            "/user/achievements",
            "/user/streaks",
            "/user/milestones",
        ]
        for ep in goal_endpoints:
            await probe(client, headers, "GET", ep, label="Goals")

        print(f"\n{'='*70}")
        print(f"{BOLD}{CYAN}PHASE 10: Other API versions{RESET}")
        print(f"{'='*70}")

        # Check which API versions exist and what differs
        interesting_endpoints = [
            "/user",
            "/user/diary",
            "/user/food-log",
            "/user/consumed",
            "/user/meals",
            "/user/body-data",
        ]
        for version in ["v7", "v8", "v9", "v10", "v11", "v12", "v13", "v14", "v16", "v17", "v18"]:
            for ep in interesting_endpoints:
                url = f"https://yzapi.yazio.com/{version}{ep}"
                try:
                    r = await client.get(url, headers=headers, params={"date": YESTERDAY.isoformat()})
                    if r.status_code in (200, 201):
                        try:
                            data = r.json()
                        except Exception:
                            data = {"_raw": r.text[:500]}
                        text = json.dumps(data, indent=2, default=str)
                        print(f"\n{GREEN}✅ {version}{ep} → {r.status_code}{RESET}")
                        print(text[:2000])
                        RESULTS[f"GET {version}{ep}"] = {
                            "status": r.status_code,
                            "data_preview": text[:3000],
                        }
                except Exception:
                    pass

        print(f"\n{'='*70}")
        print(f"{BOLD}{CYAN}PHASE 11: Discover API structure via /api or docs routes{RESET}")
        print(f"{'='*70}")

        meta_endpoints = [
            "/",
            "/api",
            "/docs",
            "/swagger",
            "/swagger.json",
            "/openapi",
            "/openapi.json",
            "/health",
            "/status",
            "/version",
            "/config",
            "/routes",
        ]
        for ep in meta_endpoints:
            url = f"https://yzapi.yazio.com{ep}"
            try:
                r = await client.get(url, headers=headers)
                if r.status_code in (200, 201):
                    text = r.text[:2000]
                    print(f"\n{GREEN}✅ {ep} → {r.status_code}{RESET}")
                    print(text)
            except Exception:
                pass

        # ── Summary ──
        print(f"\n\n{'='*70}")
        print(f"{BOLD}{CYAN}SUMMARY: All working endpoints{RESET}")
        print(f"{'='*70}\n")

        for key, info in sorted(RESULTS.items()):
            label = info.get("label", "")
            params = info.get("params", {})
            keys = info.get("data_keys", "")
            print(f"  {GREEN}✅{RESET} {key}")
            if label:
                print(f"     Label: {label}")
            if params:
                print(f"     Params: {params}")
            if keys:
                print(f"     Keys: {keys}")
            print()

        # Save full results to JSON
        out_path = "yazio_probe_results.json"
        with open(out_path, "w") as f:
            json.dump(RESULTS, f, indent=2, default=str)
        print(f"\n📄 Full results saved to {out_path}")


if __name__ == "__main__":
    asyncio.run(main())
