"""
One-time migration: add training_plan column to users table.

Run:  cd backend && python migrate_add_training_plan.py
"""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))

from sqlalchemy import text
from app.database import engine

def migrate():
    with engine.connect() as conn:
        # Add training_plan JSON column (nullable)
        conn.execute(text("""
            ALTER TABLE users
            ADD COLUMN IF NOT EXISTS training_plan JSON;
        """))
        conn.commit()
        print("✅ Added training_plan column to users table")

if __name__ == "__main__":
    migrate()
