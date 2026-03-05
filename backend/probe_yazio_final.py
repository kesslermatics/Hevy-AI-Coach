"""
Final comprehensive Yazio API probe - resolves all consumed items
to actual food names and calculates macros per item.

Usage: python3 probe_yazio_final.py
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

GREEN = "\033[92m"
RED = "\033[91m"
YELLOW = "\033[93m"
CYAN = "\033[96m"
BOLD = "\033[1m"
RESET = "\033[0m"
DIM = "\033[2m"


async def login(client: httpx.AsyncClient) -> str:
    email = os.getenv("YAZIO_EMAIL")
    password = os.getenv("YAZIO_PASSWORD")
    r = await client.post(f"{YAZIO_BASE_URL}/oauth/token", json={
        "client_id": YAZIO_CLIENT_ID, "client_secret": YAZIO_CLIENT_SECRET,
        "username": email, "password": password, "grant_type": "password",
    })
    assert r.status_code == 200, f"Login failed: {r.status_code}"
    return r.json()["access_token"]


async def get_product(client, headers, product_id) -> Optional[dict]:
    """Resolve a product_id to its full details including nutrients."""
    r = await client.get(f"{YAZIO_BASE_URL}/products/{product_id}", headers=headers)
    if r.status_code == 200:
        return r.json()
    return None


async def get_recipe(client, headers, recipe_id) -> Optional[dict]:
    """Resolve a recipe_id to its full details."""
    # Try different endpoints
    for ep in [f"/recipes/{recipe_id}", f"/user/recipes/{recipe_id}"]:
        r = await client.get(f"{YAZIO_BASE_URL}{ep}", headers=headers)
        if r.status_code == 200:
            return r.json()
    return None


async def main():
    async with httpx.AsyncClient(timeout=30.0) as client:
        token = await login(client)
        headers = {"Authorization": f"Bearer {token}", "Accept": "application/json"}

        yesterday = (date.today() - timedelta(days=1))

        # ═══════════════════════════════════════════════════════════
        # 1. Get consumed items for yesterday
        # ═══════════════════════════════════════════════════════════
        print(f"\n{'='*70}")
        print(f"{BOLD}{CYAN}FULL FOOD DIARY for {yesterday.isoformat()}{RESET}")
        print(f"{'='*70}")

        r = await client.get(f"{YAZIO_BASE_URL}/user/consumed-items",
                            headers=headers, params={"date": yesterday.isoformat()})
        assert r.status_code == 200
        consumed = r.json()

        # Collect all product IDs
        product_ids = set()
        recipe_ids = set()
        for p in consumed.get("products", []):
            product_ids.add(p["product_id"])
        for rp in consumed.get("recipe_portions", []):
            recipe_ids.add(rp.get("recipe_id") or rp.get("id"))
        for sp in consumed.get("simple_products", []):
            if "product_id" in sp:
                product_ids.add(sp["product_id"])

        # ── Batch resolve all products ──
        print(f"\n{CYAN}Resolving {len(product_ids)} products...{RESET}")
        product_cache = {}
        for pid in product_ids:
            product = await get_product(client, headers, pid)
            if product:
                product_cache[pid] = product

        # ── Batch resolve all recipes ──
        recipe_cache = {}
        if recipe_ids:
            print(f"{CYAN}Resolving {len(recipe_ids)} recipes...{RESET}")
            for rid in recipe_ids:
                recipe = await get_recipe(client, headers, rid)
                if recipe:
                    recipe_cache[rid] = recipe

        # ── Group items by meal type (daytime) ──
        meals_grouped = {"breakfast": [], "lunch": [], "dinner": [], "snack": []}

        for item in consumed.get("products", []):
            daytime = item.get("daytime", "snack")
            pid = item["product_id"]
            product = product_cache.get(pid, {})
            nutrients = product.get("nutrients", {})
            amount = item.get("amount", 0)

            # Nutrients are per 1g (base_unit=g), multiply by amount
            cal = nutrients.get("energy.energy", 0) * amount
            protein = nutrients.get("nutrient.protein", 0) * amount
            carbs = nutrients.get("nutrient.carb", 0) * amount
            fat = nutrients.get("nutrient.fat", 0) * amount
            fiber = nutrients.get("nutrient.dietaryfiber", 0) * amount
            sugar = nutrients.get("nutrient.sugar", 0) * amount
            salt = nutrients.get("nutrient.salt", 0) * amount
            saturated = nutrients.get("nutrient.saturated", 0) * amount

            meals_grouped.setdefault(daytime, []).append({
                "name": product.get("name", f"[Unknown: {pid}]"),
                "producer": product.get("producer", ""),
                "category": product.get("category", ""),
                "amount": amount,
                "serving": item.get("serving", ""),
                "serving_quantity": item.get("serving_quantity", 0),
                "time": item.get("date", ""),
                "calories": round(cal, 1),
                "protein": round(protein, 1),
                "carbs": round(carbs, 1),
                "fat": round(fat, 1),
                "fiber": round(fiber, 1),
                "sugar": round(sugar, 1),
                "salt": round(salt, 2),
                "saturated_fat": round(saturated, 1),
            })

        # Also handle recipe_portions
        for item in consumed.get("recipe_portions", []):
            daytime = item.get("daytime", "snack")
            rid = item.get("recipe_id") or item.get("id")
            recipe = recipe_cache.get(rid, {})
            meals_grouped.setdefault(daytime, []).append({
                "name": f"[Recipe: {recipe.get('name', rid)}]",
                "amount": item.get("amount", 0),
                "serving": item.get("serving", ""),
                "time": item.get("date", ""),
                "raw_recipe": recipe,
            })

        # Also handle simple_products
        for item in consumed.get("simple_products", []):
            daytime = item.get("daytime", "snack")
            meals_grouped.setdefault(daytime, []).append({
                "name": item.get("name", "[Simple product]"),
                "amount": item.get("amount", 0),
                "raw": item,
            })

        # ── Pretty print ──
        meal_icons = {
            "breakfast": "🌅 Frühstück",
            "lunch": "☀️  Mittagessen",
            "dinner": "🌙 Abendessen",
            "snack": "🍫 Snacks",
        }

        grand_total = {"calories": 0, "protein": 0, "carbs": 0, "fat": 0}

        for meal_key in ["breakfast", "lunch", "dinner", "snack"]:
            items = meals_grouped.get(meal_key, [])
            if not items:
                continue

            meal_cal = sum(i.get("calories", 0) for i in items)
            meal_prot = sum(i.get("protein", 0) for i in items)
            meal_carb = sum(i.get("carbs", 0) for i in items)
            meal_fat = sum(i.get("fat", 0) for i in items)

            grand_total["calories"] += meal_cal
            grand_total["protein"] += meal_prot
            grand_total["carbs"] += meal_carb
            grand_total["fat"] += meal_fat

            print(f"\n{BOLD}{meal_icons.get(meal_key, meal_key)}{RESET}  "
                  f"({meal_cal:.0f} kcal | P:{meal_prot:.1f}g | C:{meal_carb:.1f}g | F:{meal_fat:.1f}g)")
            print(f"  {'─'*65}")

            for item in items:
                name = item.get("name", "?")
                cal = item.get("calories", 0)
                prot = item.get("protein", 0)
                carb = item.get("carbs", 0)
                fat = item.get("fat", 0)
                amount = item.get("amount", 0)
                serving = item.get("serving", "")
                producer = item.get("producer", "")

                producer_str = f" ({producer})" if producer else ""
                print(f"  {name}{producer_str}")
                print(f"    {DIM}{amount}g ({serving}) → {cal:.0f} kcal | P:{prot:.1f}g | C:{carb:.1f}g | F:{fat:.1f}g{RESET}")

        print(f"\n{'─'*65}")
        print(f"{BOLD}TAGESGESAMT: {grand_total['calories']:.0f} kcal | "
              f"P:{grand_total['protein']:.1f}g | "
              f"C:{grand_total['carbs']:.1f}g | "
              f"F:{grand_total['fat']:.1f}g{RESET}")

        # ═══════════════════════════════════════════════════════════
        # 2. Compare with daily-summary aggregates
        # ═══════════════════════════════════════════════════════════
        print(f"\n{'='*70}")
        print(f"{BOLD}{CYAN}CROSS-CHECK: daily-summary vs calculated{RESET}")
        print(f"{'='*70}")

        r2 = await client.get(f"{YAZIO_BASE_URL}/user/widgets/daily-summary",
                             headers=headers, params={"date": yesterday.isoformat()})
        if r2.status_code == 200:
            summary = r2.json()
            meals_summary = summary.get("meals", {})
            for key in ["breakfast", "lunch", "dinner", "snack"]:
                s_nutrients = meals_summary.get(key, {}).get("nutrients", {})
                s_cal = s_nutrients.get("energy.energy", 0)
                c_cal = sum(i.get("calories", 0) for i in meals_grouped.get(key, []))
                match = "✅" if abs(s_cal - c_cal) < 2 else "⚠️"
                print(f"  {match} {key}: summary={s_cal:.0f} kcal vs calculated={c_cal:.0f} kcal")

        # ═══════════════════════════════════════════════════════════
        # 3. Exercise details
        # ═══════════════════════════════════════════════════════════
        print(f"\n{'='*70}")
        print(f"{BOLD}{CYAN}EXERCISES for {yesterday.isoformat()}{RESET}")
        print(f"{'='*70}")

        r3 = await client.get(f"{YAZIO_BASE_URL}/user/exercises",
                             headers=headers, params={"date": yesterday.isoformat()})
        if r3.status_code == 200:
            exercises = r3.json()
            print(json.dumps(exercises, indent=2, default=str)[:3000])

        # ═══════════════════════════════════════════════════════════
        # 4. Water intake
        # ═══════════════════════════════════════════════════════════
        print(f"\n{'='*70}")
        print(f"{BOLD}{CYAN}WATER INTAKE for {yesterday.isoformat()}{RESET}")
        print(f"{'='*70}")

        r4 = await client.get(f"{YAZIO_BASE_URL}/user/water-intake",
                             headers=headers, params={"date": yesterday.isoformat()})
        if r4.status_code == 200:
            water = r4.json()
            print(json.dumps(water, indent=2, default=str))

        # ═══════════════════════════════════════════════════════════
        # 5. Resolve recipes
        # ═══════════════════════════════════════════════════════════
        print(f"\n{'='*70}")
        print(f"{BOLD}{CYAN}RECIPE DETAILS{RESET}")
        print(f"{'='*70}")

        r5 = await client.get(f"{YAZIO_BASE_URL}/user/recipes", headers=headers)
        if r5.status_code == 200:
            recipe_ids = r5.json()
            print(f"Found {len(recipe_ids)} recipes")
            for rid in recipe_ids[:3]:  # Just first 3
                # Try resolving recipe
                for ep in [f"/recipes/{rid}", f"/user/recipes/{rid}"]:
                    r6 = await client.get(f"{YAZIO_BASE_URL}{ep}", headers=headers)
                    if r6.status_code == 200:
                        print(f"\n{GREEN}✅ Recipe {rid}:{RESET}")
                        print(json.dumps(r6.json(), indent=2, default=str)[:2000])
                        break
                    elif r6.status_code != 404:
                        print(f"  {ep} → {r6.status_code}")

        # ═══════════════════════════════════════════════════════════
        # 6. Fasting data
        # ═══════════════════════════════════════════════════════════
        print(f"\n{'='*70}")
        print(f"{BOLD}{CYAN}FASTING DATA{RESET}")
        print(f"{'='*70}")

        for ep in ["/user/fasting-countdowns", "/user/fasting-countdown"]:
            r7 = await client.get(f"{YAZIO_BASE_URL}{ep}", headers=headers)
            if r7.status_code == 200:
                print(f"\n{GREEN}✅ {ep}:{RESET}")
                print(json.dumps(r7.json(), indent=2, default=str)[:2000])

        # ═══════════════════════════════════════════════════════════
        # 7. Body data on different versions
        # ═══════════════════════════════════════════════════════════
        print(f"\n{'='*70}")
        print(f"{BOLD}{CYAN}BODY DATA PROBING{RESET}")
        print(f"{'='*70}")

        for version in ["v7", "v8", "v9", "v10", "v11", "v12", "v13", "v14", "v15", "v16", "v17", "v18"]:
            for ep in ["/user/body-data", "/user/body", "/user/weight", "/user/body-entries"]:
                r8 = await client.get(
                    f"https://yzapi.yazio.com/{version}{ep}",
                    headers=headers,
                    params={"date": yesterday.isoformat()}
                )
                if r8.status_code == 200:
                    print(f"\n{GREEN}✅ {version}{ep}:{RESET}")
                    print(json.dumps(r8.json(), indent=2, default=str)[:1500])

        # ═══════════════════════════════════════════════════════════
        # 8. Full raw dump of consumed-items structure
        # ═══════════════════════════════════════════════════════════
        print(f"\n{'='*70}")
        print(f"{BOLD}{CYAN}RAW CONSUMED-ITEMS STRUCTURE{RESET}")
        print(f"{'='*70}")
        print(f"Keys: {list(consumed.keys())}")
        print(f"products count: {len(consumed.get('products', []))}")
        print(f"recipe_portions count: {len(consumed.get('recipe_portions', []))}")
        print(f"simple_products count: {len(consumed.get('simple_products', []))}")

        if consumed.get("products"):
            print(f"\nSample product entry keys: {list(consumed['products'][0].keys())}")

        if consumed.get("recipe_portions"):
            print(f"\nSample recipe_portion entry: {json.dumps(consumed['recipe_portions'][0], default=str)}")

        if consumed.get("simple_products"):
            print(f"\nSample simple_product entry: {json.dumps(consumed['simple_products'][0], default=str)}")

        # ═══════════════════════════════════════════════════════════
        # 9. Full product detail dump (one example)
        # ═══════════════════════════════════════════════════════════
        print(f"\n{'='*70}")
        print(f"{BOLD}{CYAN}FULL PRODUCT DETAIL (sample){RESET}")
        print(f"{'='*70}")
        if product_cache:
            first_pid = list(product_cache.keys())[0]
            print(f"Product {first_pid}:")
            print(json.dumps(product_cache[first_pid], indent=2, default=str))


if __name__ == "__main__":
    asyncio.run(main())
