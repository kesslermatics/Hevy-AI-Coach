"""
Deep probe Yazio API for weight/body log entries.
"""
import asyncio, os, json
from datetime import date, timedelta
import httpx
from dotenv import load_dotenv

load_dotenv()

YAZIO_BASE_URL = "https://yzapi.yazio.com/v15"
YAZIO_CLIENT_ID = "1_4hiybetvfksgw40o0sog4s884kwc840wwso8go4k8c04goo4c"
YAZIO_CLIENT_SECRET = "6rok2m65xuskgkgogw40wkkk8sw0osg84s8cggsc4woos4s8o"

async def main():
    email = os.getenv("YAZIO_EMAIL")
    password = os.getenv("YAZIO_PASSWORD")

    async with httpx.AsyncClient(timeout=30.0) as client:
        r = await client.post(f"{YAZIO_BASE_URL}/oauth/token", json={
            "client_id": YAZIO_CLIENT_ID, "client_secret": YAZIO_CLIENT_SECRET,
            "username": email, "password": password, "grant_type": "password"
        })
        token = r.json().get("access_token", "")
        headers = {"Authorization": f"Bearer {token}", "Accept": "application/json"}

        # Try endpoints with date parameters
        today = date.today()
        month_ago = today - timedelta(days=30)
        
        endpoints_with_params = [
            ("/user/body-data", {"from": month_ago.isoformat(), "to": today.isoformat()}),
            ("/user/body-data", {"date": today.isoformat()}),
            ("/user/diary/body", {"from": month_ago.isoformat(), "to": today.isoformat()}),
            ("/user/diary/weight", {"from": month_ago.isoformat(), "to": today.isoformat()}),
            ("/user/journal", {"from": month_ago.isoformat(), "to": today.isoformat()}),
            ("/user/journal", {}),
            ("/user/entries", {"from": month_ago.isoformat(), "to": today.isoformat()}),
            ("/user/entries/body", {}),
            ("/user/tracking/body", {}),
            ("/user/tracking/weight", {}),
        ]
        
        print("--- Parameterized endpoints ---")
        for ep, params in endpoints_with_params:
            try:
                r2 = await client.get(f"{YAZIO_BASE_URL}{ep}", headers=headers, params=params)
                if r2.status_code == 200:
                    data = r2.json()
                    text = json.dumps(data, indent=2, default=str)
                    print(f"\n✅ {ep} {params} → {r2.status_code}")
                    print(text[:2000])
                else:
                    print(f"❌ {ep} {params} → {r2.status_code}")
            except Exception as e:
                print(f"❌ {ep} → ERROR: {e}")
        
        # Try API versions
        for version in ["v14", "v13", "v16", "v17"]:
            base = f"https://yzapi.yazio.com/{version}"
            for ep in ["/user/body-data", "/user/weights", "/user/body-entries"]:
                try:
                    r2 = await client.get(f"{base}{ep}", headers=headers)
                    if r2.status_code == 200:
                        data = r2.json()
                        text = json.dumps(data, indent=2, default=str)
                        print(f"\n✅ {version}{ep} → {r2.status_code}")
                        print(text[:2000])
                    else:
                        print(f"❌ {version}{ep} → {r2.status_code}")
                except Exception as e:
                    print(f"❌ {version}{ep} → ERROR: {e}")

        # Check if /user has weight_entries or body_log
        r3 = await client.get(f"{YAZIO_BASE_URL}/user", headers=headers)
        if r3.status_code == 200:
            data = r3.json()
            print(f"\n📊 Full /user keys: {list(data.keys())}")
            # Print all of it
            print(json.dumps(data, indent=2, default=str)[:5000])

asyncio.run(main())
