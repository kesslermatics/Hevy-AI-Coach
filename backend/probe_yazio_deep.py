"""
Deep probe of Yazio consumed-items and product resolution.
Gets individual tracked foods with their names, amounts, and macros.

Usage:
  python3 probe_yazio_deep.py
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


async def login(client: httpx.AsyncClient) -> str:
    email = os.getenv("YAZIO_EMAIL")
    password = os.getenv("YAZIO_PASSWORD")
    r = await client.post(f"{YAZIO_BASE_URL}/oauth/token", json={
        "client_id": YAZIO_CLIENT_ID, "client_secret": YAZIO_CLIENT_SECRET,
        "username": email, "password": password, "grant_type": "password",
    })
    assert r.status_code == 200, f"Login failed: {r.status_code}"
    return r.json()["access_token"]


async def try_endpoint(client, headers, method, path, params=None, label=""):
    url = f"{YAZIO_BASE_URL}{path}"
    try:
        r = await client.get(url, headers=headers, params=params) if method == "GET" else None
        if r and r.status_code == 200:
            data = r.json()
            print(f"\n{GREEN}✅ {label}: {method} {path} params={params}{RESET}")
            print(json.dumps(data, indent=2, default=str)[:4000])
            return data
        elif r:
            if r.status_code != 404:
                print(f"  {YELLOW}{label}: {path} → {r.status_code}{RESET}")
    except Exception as e:
        print(f"  {RED}{path} → {e}{RESET}")
    return None


async def main():
    async with httpx.AsyncClient(timeout=30.0) as client:
        token = await login(client)
        headers = {"Authorization": f"Bearer {token}", "Accept": "application/json"}

        yesterday = (date.today() - timedelta(days=1)).isoformat()
        two_days_ago = (date.today() - timedelta(days=2)).isoformat()

        # ═══════════════════════════════════════════════════════════
        # 1. CONSUMED ITEMS - the gold mine
        # ═══════════════════════════════════════════════════════════
        print(f"\n{'='*70}")
        print(f"{BOLD}{CYAN}1. CONSUMED ITEMS (individual tracked foods){RESET}")
        print(f"{'='*70}")

        consumed = await try_endpoint(client, headers, "GET",
            "/user/consumed-items", {"date": yesterday}, "Consumed items")

        # Try with additional params
        for extra_params in [
            {"date": yesterday, "include_nutrients": "true"},
            {"date": yesterday, "with_nutrients": "true"},
            {"date": yesterday, "expand": "products"},
            {"date": yesterday, "include": "products"},
            {"date": yesterday, "details": "true"},
        ]:
            await try_endpoint(client, headers, "GET",
                "/user/consumed-items", extra_params, f"Consumed+params")

        # Try by meal type
        for meal in ["breakfast", "lunch", "dinner", "snack"]:
            await try_endpoint(client, headers, "GET",
                f"/user/consumed-items/{meal}", {"date": yesterday}, f"Consumed/{meal}")
            await try_endpoint(client, headers, "GET",
                "/user/consumed-items", {"date": yesterday, "meal": meal}, f"Consumed?meal={meal}")
            await try_endpoint(client, headers, "GET",
                "/user/consumed-items", {"date": yesterday, "meal_type": meal}, f"Consumed?type={meal}")

        # ═══════════════════════════════════════════════════════════
        # 2. PRODUCT LOOKUP - resolve product_id to name + nutrients
        # ═══════════════════════════════════════════════════════════
        print(f"\n{'='*70}")
        print(f"{BOLD}{CYAN}2. PRODUCT DETAILS (resolve product_id → name + macros){RESET}")
        print(f"{'='*70}")

        # Collect all product IDs from consumed items
        product_ids = set()
        recipe_ids = set()
        if consumed:
            for p in consumed.get("products", []):
                product_ids.add(p.get("product_id"))
            for rp in consumed.get("recipe_portions", []):
                recipe_ids.add(rp.get("recipe_id", rp.get("id")))
            for sp in consumed.get("simple_products", []):
                product_ids.add(sp.get("product_id", sp.get("id")))

        print(f"\nProduct IDs found: {product_ids}")
        print(f"Recipe IDs found: {recipe_ids}")

        # Try to look up individual products
        if product_ids:
            sample_id = list(product_ids)[0]
            print(f"\nProbing product lookup with ID: {sample_id}")

            # Try various product lookup patterns
            product_endpoints = [
                f"/products/{sample_id}",
                f"/product/{sample_id}",
                f"/foods/{sample_id}",
                f"/food/{sample_id}",
                f"/user/products/{sample_id}",
                f"/user/product/{sample_id}",
            ]
            for ep in product_endpoints:
                await try_endpoint(client, headers, "GET", ep, label=f"Product lookup")

            # Try batch product lookup
            ids_str = ",".join(list(product_ids)[:5])
            batch_endpoints = [
                ("/products", {"ids": ids_str}),
                ("/products", {"product_ids": ids_str}),
                ("/products", {"id": ids_str}),
                ("/products/batch", {"ids": ids_str}),
                ("/user/products", {"ids": ids_str}),
            ]
            for ep, params in batch_endpoints:
                await try_endpoint(client, headers, "GET", ep, params, "Batch products")

            # Try different API versions for product lookup
            for version in ["v7", "v8", "v9", "v10", "v11", "v12", "v13", "v14", "v16"]:
                url = f"https://yzapi.yazio.com/{version}/products/{sample_id}"
                try:
                    r = await client.get(url, headers=headers)
                    if r.status_code == 200:
                        data = r.json()
                        print(f"\n{GREEN}✅ {version}/products/{sample_id} → 200{RESET}")
                        print(json.dumps(data, indent=2, default=str)[:3000])
                except Exception as e:
                    pass

        # ═══════════════════════════════════════════════════════════
        # 3. RECIPES - user's saved recipes
        # ═══════════════════════════════════════════════════════════
        print(f"\n{'='*70}")
        print(f"{BOLD}{CYAN}3. USER RECIPES{RESET}")
        print(f"{'='*70}")

        recipes = await try_endpoint(client, headers, "GET", "/user/recipes", label="Recipes list")
        if recipes and isinstance(recipes, list) and len(recipes) > 0:
            # Try individual recipe
            recipe_id = recipes[0].get("id")
            if recipe_id:
                await try_endpoint(client, headers, "GET", f"/user/recipes/{recipe_id}", label="Recipe detail")
                await try_endpoint(client, headers, "GET", f"/recipes/{recipe_id}", label="Recipe detail")

        # ═══════════════════════════════════════════════════════════
        # 4. USER MEALS (saved meal templates)
        # ═══════════════════════════════════════════════════════════
        print(f"\n{'='*70}")
        print(f"{BOLD}{CYAN}4. USER MEALS (saved meal templates){RESET}")
        print(f"{'='*70}")

        meals = await try_endpoint(client, headers, "GET", "/user/meals", label="Meal templates")
        if meals and isinstance(meals, list) and len(meals) > 0:
            meal_id = meals[0].get("id")
            if meal_id:
                await try_endpoint(client, headers, "GET", f"/user/meals/{meal_id}", label="Meal detail")

        # ═══════════════════════════════════════════════════════════
        # 5. EXERCISES / ACTIVITY details
        # ═══════════════════════════════════════════════════════════
        print(f"\n{'='*70}")
        print(f"{BOLD}{CYAN}5. EXERCISES / ACTIVITY{RESET}")
        print(f"{'='*70}")

        exercises = await try_endpoint(client, headers, "GET",
            "/user/exercises", {"date": yesterday}, "Exercises")

        # Try more exercise endpoints
        for ep in [
            "/user/exercises/training",
            "/user/exercises/activity",
            "/user/activities",
            "/user/training",
            "/user/sports",
        ]:
            await try_endpoint(client, headers, "GET", ep, {"date": yesterday}, f"Exercise: {ep}")

        # ═══════════════════════════════════════════════════════════
        # 6. WATER INTAKE details
        # ═══════════════════════════════════════════════════════════
        print(f"\n{'='*70}")
        print(f"{BOLD}{CYAN}6. WATER INTAKE{RESET}")
        print(f"{'='*70}")

        await try_endpoint(client, headers, "GET",
            "/user/water-intake", {"date": yesterday}, "Water")
        await try_endpoint(client, headers, "GET",
            "/user/water-intake", {"date": two_days_ago}, "Water day before")

        # ═══════════════════════════════════════════════════════════
        # 7. BODY DATA / WEIGHT HISTORY
        # ═══════════════════════════════════════════════════════════
        print(f"\n{'='*70}")
        print(f"{BOLD}{CYAN}7. BODY DATA / WEIGHT{RESET}")
        print(f"{'='*70}")

        for ep in ["/user/body-data", "/user/body"]:
            await try_endpoint(client, headers, "GET", ep, {"date": yesterday}, "Body data")

        # Try different API versions for body data
        for version in ["v7", "v8", "v9", "v10", "v11", "v12", "v13", "v14"]:
            for ep in ["/user/body-data", "/user/body", "/user/weight"]:
                url = f"https://yzapi.yazio.com/{version}{ep}"
                try:
                    r = await client.get(url, headers=headers, params={"date": yesterday})
                    if r.status_code == 200:
                        data = r.json()
                        print(f"\n{GREEN}✅ {version}{ep} → 200{RESET}")
                        print(json.dumps(data, indent=2, default=str)[:2000])
                except Exception:
                    pass

        # ═══════════════════════════════════════════════════════════
        # 8. USER SETTINGS & GOALS details
        # ═══════════════════════════════════════════════════════════
        print(f"\n{'='*70}")
        print(f"{BOLD}{CYAN}8. SETTINGS & GOALS{RESET}")
        print(f"{'='*70}")

        await try_endpoint(client, headers, "GET", "/user/settings", label="Settings")
        await try_endpoint(client, headers, "GET", "/user/subscription", label="Subscription")

        # Fasting
        for ep in ["/user/fasting", "/user/fasting/history", "/user/fasting/current",
                    "/user/fasting-countdown", "/user/fasting-countdowns"]:
            await try_endpoint(client, headers, "GET", ep, label="Fasting")

        # ═══════════════════════════════════════════════════════════
        # 9. CONSUMED ITEMS across multiple days
        # ═══════════════════════════════════════════════════════════
        print(f"\n{'='*70}")
        print(f"{BOLD}{CYAN}9. CONSUMED ITEMS - multiple days{RESET}")
        print(f"{'='*70}")

        # Gather all product IDs from last 3 days
        all_product_ids = set()
        all_recipe_portions_ids = set()
        all_simple_product_ids = set()

        for days_back in range(1, 4):
            d = (date.today() - timedelta(days=days_back)).isoformat()
            r = await client.get(f"{YAZIO_BASE_URL}/user/consumed-items",
                                headers=headers, params={"date": d})
            if r.status_code == 200:
                data = r.json()
                products = data.get("products", [])
                recipe_portions = data.get("recipe_portions", [])
                simple_products = data.get("simple_products", [])

                print(f"\n{CYAN}Date: {d}{RESET}")
                print(f"  Products: {len(products)} items")
                for p in products:
                    pid = p.get("product_id")
                    all_product_ids.add(pid)
                    print(f"    - {pid}: {p.get('amount')}x {p.get('serving')} (meal: {p.get('meal_type', 'N/A')}, serving_qty: {p.get('serving_quantity')})")

                print(f"  Recipe portions: {len(recipe_portions)} items")
                for rp in recipe_portions:
                    rid = rp.get("recipe_id") or rp.get("id")
                    print(f"    - {json.dumps(rp, default=str)[:200]}")
                    if rid:
                        all_recipe_portions_ids.add(rid)

                print(f"  Simple products: {len(simple_products)} items")
                for sp in simple_products:
                    print(f"    - {json.dumps(sp, default=str)[:200]}")

        # ═══════════════════════════════════════════════════════════
        # 10. Try to resolve ALL product IDs found
        # ═══════════════════════════════════════════════════════════
        print(f"\n{'='*70}")
        print(f"{BOLD}{CYAN}10. RESOLVE ALL PRODUCT IDs{RESET}")
        print(f"{'='*70}")
        print(f"Total unique product IDs: {len(all_product_ids)}")

        for pid in list(all_product_ids)[:10]:  # Limit to 10 to not spam
            for version in ["v15", "v14", "v13"]:
                url = f"https://yzapi.yazio.com/{version}/products/{pid}"
                try:
                    r = await client.get(url, headers=headers)
                    if r.status_code == 200:
                        data = r.json()
                        name = data.get("name", data.get("product_name", "???"))
                        nutrients = data.get("nutrients", {})
                        print(f"\n{GREEN}✅ Product {pid} ({version}): {name}{RESET}")
                        print(json.dumps(data, indent=2, default=str)[:2000])
                        break  # Found it, no need to try other versions
                    elif r.status_code != 404:
                        print(f"  {YELLOW}{version}/products/{pid} → {r.status_code}{RESET}")
                except Exception:
                    pass

        # ═══════════════════════════════════════════════════════════
        # 11. Check if consumed-items has more detail with meal_type field
        # ═══════════════════════════════════════════════════════════
        print(f"\n{'='*70}")
        print(f"{BOLD}{CYAN}11. FULL consumed-items structure{RESET}")
        print(f"{'='*70}")

        r = await client.get(f"{YAZIO_BASE_URL}/user/consumed-items",
                            headers=headers, params={"date": yesterday})
        if r.status_code == 200:
            data = r.json()
            print(f"\n{GREEN}FULL RAW consumed-items for {yesterday}:{RESET}")
            print(json.dumps(data, indent=2, default=str))


if __name__ == "__main__":
    asyncio.run(main())
