"""
Probe Yazio API for weight history endpoints.
Run: python3 debug_weight_history.py
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
    print(f"Email: {email}")

    async with httpx.AsyncClient(timeout=30.0) as client:
        r = await client.post(f"{YAZIO_BASE_URL}/oauth/token", json={
            "client_id": YAZIO_CLIENT_ID, "client_secret": YAZIO_CLIENT_SECRET,
            "username": email, "password": password, "grant_type": "password"
        })
        print(f"Login status: {r.status_code}")
        token = r.json().get("access_token", "")
        headers = {"Authorization": f"Bearer {token}", "Accept": "application/json"}

        # Try various weight/body endpoints
        endpoints = [
            "/user/body-data",
            "/user/body-entries",
            "/user/body",
            "/user/weights",
            "/user/weight-history",
            "/user/widgets/weight",
            "/user/widgets/weight-history",
            "/user/widgets/body-data",
            "/user/measurements",
        ]

        for ep in endpoints:
            try:
                r2 = await client.get(f"{YAZIO_BASE_URL}{ep}", headers=headers)
                status = r2.status_code
                if status == 200:
                    data = r2.json()
                    text = json.dumps(data, indent=2, default=str)
                    print(f"\n✅ {ep} → {status}")
                    print(text[:2000])
                else:
                    print(f"\n❌ {ep} → {status}: {r2.text[:200]}")
            except Exception as e:
                print(f"\n❌ {ep} → ERROR: {e}")

        # Also check the daily-summary user field for weight info
        yesterday = (date.today() - timedelta(days=1)).isoformat()
        r3 = await client.get(f"{YAZIO_BASE_URL}/user/widgets/daily-summary", headers=headers, params={"date": yesterday})
        if r3.status_code == 200:
            data = r3.json()
            user_data = data.get("user", {})
            print(f"\n📊 daily-summary 'user' field:")
            print(json.dumps(user_data, indent=2, default=str))

        # Check user profile for weight data
        r4 = await client.get(f"{YAZIO_BASE_URL}/user", headers=headers)
        if r4.status_code == 200:
            data = r4.json()
            # Print only weight-related fields
            weight_fields = {k: v for k, v in data.items() if 'weight' in k.lower() or 'body' in k.lower() or 'goal' in k.lower()}
            print(f"\n📊 /user weight-related fields:")
            print(json.dumps(weight_fields, indent=2, default=str))

asyncio.run(main())
