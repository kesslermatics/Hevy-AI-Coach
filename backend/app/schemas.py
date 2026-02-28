"""
Pydantic schemas for request/response validation.
"""
from pydantic import BaseModel, Field
from typing import Optional, Any
from uuid import UUID
from datetime import date


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
    current_goal: Optional[str] = None
    target_weight: Optional[float] = None
    first_name: Optional[str] = None
    language: str = "de"
    training_plan: Optional[list[str]] = None
    
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


# ============ Goal Schemas ============

class GoalUpdate(BaseModel):
    """Schema for updating user goal and target weight."""
    current_goal: str = Field(..., min_length=1, max_length=100,
                              description="e.g. Lean Bulk, Cut, Maintain, Recomp")
    target_weight: Optional[float] = Field(None, gt=0, le=500,
                                           description="Target weight in kg")


class GoalResponse(BaseModel):
    """Schema for goal update response."""
    message: str
    current_goal: Optional[str] = None
    target_weight: Optional[float] = None


# ============ Language Schemas ============

class LanguageUpdate(BaseModel):
    """Schema for updating user language."""
    language: str = Field(..., pattern="^(de|en)$", description="Language code: 'de' or 'en'")


class LanguageResponse(BaseModel):
    """Schema for language update response."""
    message: str
    language: str


# ============ Training Plan Schemas ============

class TrainingPlanUpdate(BaseModel):
    """Schema for updating the user's training plan (list of workout names)."""
    workout_names: list[str] = Field(..., min_length=0, max_length=20,
                                      description="List of workout names that form the current plan")


class TrainingPlanResponse(BaseModel):
    """Schema for training plan update response."""
    message: str
    training_plan: list[str]


# ============ Briefing Schemas ============

class NutritionReview(BaseModel):
    """Per-macro nutrition breakdown from the AI."""
    calories: str
    protein: str
    carbs: str
    fat: str


class BriefingData(BaseModel):
    """The AI-generated briefing payload."""
    nutrition_review: NutritionReview
    workout_suggestion: str
    daily_mission: str


class BriefingResponse(BaseModel):
    """Schema returned to frontend for today's briefing."""
    id: UUID
    date: date
    briefing_data: Any     # raw JSON from the AI
    created_at: Any

    class Config:
        from_attributes = True
