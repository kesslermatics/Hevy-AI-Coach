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
        
        yesterday = (date.today() - timedelta(days=1)).isoformat()
        print(f"Date: {yesterday}")
        
        r2 = await client.get(f"{YAZIO_BASE_URL}/user/widgets/daily-summary", headers=headers, params={"date": yesterday})
        print(f"Summary status: {r2.status_code}")
        data = r2.json()
        print(json.dumps(data, indent=2, default=str)[:5000])

asyncio.run(main())
