"""
Migration: Add WorkoutReview table for persistent AI reviews + tips.

Run once:
  cd backend
  python migrate_add_workout_reviews.py
"""
from sqlalchemy import text
from app.database import engine

STATEMENTS = [
    # ── WorkoutReview table ──────────────────────────────
    """
    CREATE TABLE IF NOT EXISTS workout_reviews (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        hevy_workout_id VARCHAR(64) NOT NULL,
        workout_name VARCHAR(255) NOT NULL,
        workout_date TIMESTAMPTZ NOT NULL,
        review_data JSONB NOT NULL,
        tips_data JSONB,
        is_read BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ DEFAULT now(),
        CONSTRAINT uq_user_workout UNIQUE (user_id, hevy_workout_id)
    );
    """,
    """
    CREATE INDEX IF NOT EXISTS ix_workout_reviews_user_id
    ON workout_reviews (user_id);
    """,
    """
    CREATE INDEX IF NOT EXISTS ix_workout_reviews_hevy_workout_id
    ON workout_reviews (hevy_workout_id);
    """,
    """
    CREATE INDEX IF NOT EXISTS ix_workout_reviews_workout_name
    ON workout_reviews (workout_name);
    """,
]


def migrate():
    with engine.connect() as conn:
        for stmt in STATEMENTS:
            print(f"  ▸ Running: {stmt.strip()[:60]}…")
            conn.execute(text(stmt))
        conn.commit()
    print("\n✅ Migration complete – workout_reviews table created!")


if __name__ == "__main__":
    migrate()
