"""
Database migration: Add yazio_email and yazio_password columns to users table.
Also widen hevy_api_key to 512 chars for encrypted values.

Run once:  python migrate_add_yazio.py
"""
import os
from dotenv import load_dotenv
from sqlalchemy import create_engine, text

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "")

engine = create_engine(DATABASE_URL)

MIGRATIONS = [
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS yazio_email VARCHAR(512);",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS yazio_password VARCHAR(512);",
    "ALTER TABLE users ALTER COLUMN hevy_api_key TYPE VARCHAR(512);",
]

if __name__ == "__main__":
    print("🔧 Running migrations...")
    with engine.connect() as conn:
        for sql in MIGRATIONS:
            print(f"   → {sql}")
            conn.execute(text(sql))
        conn.commit()
    print("✅ Migrations complete!")
