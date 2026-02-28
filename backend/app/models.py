"""
SQLAlchemy database models.
"""
import uuid
from sqlalchemy import Column, String, Float, Boolean, Date, DateTime, ForeignKey, JSON, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class User(Base):
    """User model for authentication and API key storage."""
    
    __tablename__ = "users"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    username = Column(String(50), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    hevy_api_key = Column(String(512), nullable=True)       # Encrypted with Fernet
    yazio_email = Column(String(512), nullable=True)         # Encrypted with Fernet
    yazio_password = Column(String(512), nullable=True)      # Encrypted with Fernet
    current_goal = Column(String(100), nullable=True)        # e.g. "Lean Bulk", "Cut", "Maintain"
    target_weight = Column(Float, nullable=True)             # in kg
    first_name = Column(String(100), nullable=True)          # From Yazio profile
    language = Column(String(5), nullable=False, server_default="de")  # "de" or "en"
    training_plan = Column(JSON, nullable=True)                          # List of workout names in current plan
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    briefings = relationship("MorningBriefing", back_populates="user", cascade="all, delete-orphan")
    workout_reviews = relationship("WorkoutReview", back_populates="user", cascade="all, delete-orphan")
    weight_entries = relationship("WeightEntry", back_populates="user", cascade="all, delete-orphan")
    
    def __repr__(self):
        return f"<User(id={self.id}, username={self.username})>"


class MorningBriefing(Base):
    """Stores the AI-generated daily morning briefing per user."""
    
    __tablename__ = "morning_briefings"
    __table_args__ = (
        UniqueConstraint("user_id", "date", name="uq_user_date"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    date = Column(Date, nullable=False, index=True)
    briefing_data = Column(JSON, nullable=False)             # Full AI JSON response
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    user = relationship("User", back_populates="briefings")

    def __repr__(self):
        return f"<MorningBriefing(user_id={self.user_id}, date={self.date})>"


class WorkoutReview(Base):
    """
    Stores AI-generated session reviews & workout tips per Hevy workout.
    Generated automatically by the background scheduler.
    """

    __tablename__ = "workout_reviews"
    __table_args__ = (
        UniqueConstraint("user_id", "hevy_workout_id", name="uq_user_workout"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    hevy_workout_id = Column(String(64), nullable=False, index=True)   # Unique workout ID from Hevy
    workout_name = Column(String(255), nullable=False, index=True)     # e.g. "Push Tag", "Leg Day"
    workout_date = Column(DateTime(timezone=True), nullable=False)     # When the workout took place
    review_data = Column(JSON, nullable=False)                         # Full AI session review JSON
    tips_data = Column(JSON, nullable=True)                            # Full AI workout tips JSON
    is_read = Column(Boolean, nullable=False, server_default="false")  # Unread badge support
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    user = relationship("User", back_populates="workout_reviews")

    def __repr__(self):
        return f"<WorkoutReview(user_id={self.user_id}, workout={self.workout_name}, date={self.workout_date})>"


class WeightEntry(Base):
    """
    Stores daily weight readings collected from Yazio.
    One entry per user per date — auto-inserted whenever we fetch Yazio data.
    """

    __tablename__ = "weight_entries"
    __table_args__ = (
        UniqueConstraint("user_id", "date", name="uq_user_weight_date"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    date = Column(Date, nullable=False, index=True)
    weight_kg = Column(Float, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="weight_entries")

    def __repr__(self):
        return f"<WeightEntry(user_id={self.user_id}, date={self.date}, weight={self.weight_kg})>"
