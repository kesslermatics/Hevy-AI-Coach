"""
SQLAlchemy database models.
"""
import uuid
from sqlalchemy import Column, String, Float, Date, DateTime, ForeignKey, JSON, UniqueConstraint
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
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    briefings = relationship("MorningBriefing", back_populates="user", cascade="all, delete-orphan")
    
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
