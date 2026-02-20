"""
SQLAlchemy database models.
"""
import uuid
from sqlalchemy import Column, String, DateTime
from sqlalchemy.dialects.postgresql import UUID
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
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    def __repr__(self):
        return f"<User(id={self.id}, username={self.username})>"
