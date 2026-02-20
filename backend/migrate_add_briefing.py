"""
Migration: Add User goal fields + MorningBriefing table.

Run once:
  cd backend
  python migrate_add_briefing.py
"""
from sqlalchemy import text
from app.database import engine

STATEMENTS = [
    # ── User columns ────────────────────────────────────
    """
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS current_goal VARCHAR(100);
    """,
    """
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS target_weight DOUBLE PRECISION;
    """,

    # ── MorningBriefing table ────────────────────────────
    """
    CREATE TABLE IF NOT EXISTS morning_briefings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        date DATE NOT NULL,
        briefing_data JSONB NOT NULL,
        created_at TIMESTAMPTZ DEFAULT now(),
        CONSTRAINT uq_user_date UNIQUE (user_id, date)
    );
    """,
    """
    CREATE INDEX IF NOT EXISTS ix_morning_briefings_user_id
    ON morning_briefings (user_id);
    """,
    """
    CREATE INDEX IF NOT EXISTS ix_morning_briefings_date
    ON morning_briefings (date);
    """,
]


def migrate():
    with engine.connect() as conn:
        for stmt in STATEMENTS:
            print(f"  ▸ Running: {stmt.strip()[:60]}…")
            conn.execute(text(stmt))
        conn.commit()
    print("\n✅ Migration complete!")


if __name__ == "__main__":
    migrate()
