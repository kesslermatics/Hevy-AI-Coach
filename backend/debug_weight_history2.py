"""
Check if daily-summary user.current_weight changes across dates.
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

        # Check weight in daily-summary for multiple dates
        today = date.today()
        print("Date → current_weight")
        for i in range(0, 90, 7):  # Every week for ~3 months
            d = today - timedelta(days=i)
            r2 = await client.get(f"{YAZIO_BASE_URL}/user/widgets/daily-summary",
                                  headers=headers, params={"date": d.isoformat()})
            if r2.status_code == 200:
                data = r2.json()
                w = data.get("user", {}).get("current_weight")
                print(f"  {d.isoformat()} → {w} kg")

        # Also try some other undiscovered endpoints
        more_endpoints = [
            "/user/widgets/body-weight",
            "/user/widgets/body-weight-history",
            "/user/body-weight",
            "/user/body-weights",
            "/user/weight",
            "/user/diary",
            "/user/body-data/weight",
            "/user/body-measurements",
            "/user/widgets/overview",
            "/user/widgets/progress",
            "/user/widgets/body",
        ]
        print("\n--- More endpoint probing ---")
        for ep in more_endpoints:
            try:
                r2 = await client.get(f"{YAZIO_BASE_URL}{ep}", headers=headers)
                if r2.status_code == 200:
                    data = r2.json()
                    text = json.dumps(data, indent=2, default=str)
                    print(f"\n✅ {ep} → {r2.status_code}")
                    print(text[:3000])
                else:
                    print(f"❌ {ep} → {r2.status_code}")
            except Exception as e:
                print(f"❌ {ep} → ERROR: {e}")

asyncio.run(main())
