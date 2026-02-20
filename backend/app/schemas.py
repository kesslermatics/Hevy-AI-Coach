"""
Pydantic schemas for request/response validation.
"""
from pydantic import BaseModel, Field
from typing import Optional
from uuid import UUID


# ============ User Schemas ============

class UserCreate(BaseModel):
    """Schema for user registration."""
    username: str = Field(..., min_length=3, max_length=50)
    password: str = Field(..., min_length=8, max_length=100)


class UserLogin(BaseModel):
    """Schema for user login."""
    username: str
    password: str


class UserResponse(BaseModel):
    """Schema for user response (excludes sensitive data)."""
    id: UUID
    username: str
    has_hevy_key: bool = False
    has_yazio: bool = False
    
    class Config:
        from_attributes = True


class UserInDB(BaseModel):
    """Schema for user stored in database."""
    id: UUID
    username: str
    hashed_password: str
    hevy_api_key: Optional[str] = None
    yazio_email: Optional[str] = None
    yazio_password: Optional[str] = None
    
    class Config:
        from_attributes = True


# ============ API Key Schemas ============

class ApiKeyUpdate(BaseModel):
    """Schema for updating Hevy API key."""
    hevy_api_key: str = Field(..., min_length=1, max_length=255)


class ApiKeyResponse(BaseModel):
    """Schema for API key update response."""
    message: str
    has_api_key: bool


# ============ Yazio Schemas ============

class YazioCredentialsUpdate(BaseModel):
    """Schema for saving Yazio credentials."""
    yazio_email: str = Field(..., min_length=1, max_length=255)
    yazio_password: str = Field(..., min_length=1, max_length=255)


class YazioCredentialsResponse(BaseModel):
    """Schema for Yazio credentials update response."""
    message: str
    has_yazio: bool


# ============ Token Schemas ============

class Token(BaseModel):
    """Schema for JWT token response."""
    access_token: str
    token_type: str = "bearer"


class TokenData(BaseModel):
    """Schema for token payload data."""
    username: Optional[str] = None
    user_id: Optional[str] = None


# ============ Generic Responses ============

class MessageResponse(BaseModel):
    """Generic message response."""
    message: str
