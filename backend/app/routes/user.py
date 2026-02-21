"""
User routes for profile and API key management.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import User
from app.schemas import (
    UserResponse, ApiKeyUpdate, ApiKeyResponse,
    YazioCredentialsUpdate, YazioCredentialsResponse,
    GoalUpdate, GoalResponse,
    LanguageUpdate, LanguageResponse,
)
from app.dependencies import get_current_user
from app.encryption import encrypt_value

router = APIRouter(prefix="/user", tags=["User"])


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(current_user: User = Depends(get_current_user)):
    """
    Get current authenticated user's information.
    Returns user profile excluding sensitive data.
    """
    return UserResponse(
        id=current_user.id,
        username=current_user.username,
        has_hevy_key=current_user.hevy_api_key is not None,
        has_yazio=current_user.yazio_email is not None,
        current_goal=current_user.current_goal,
        target_weight=current_user.target_weight,
        language=current_user.language or "de",
    )


@router.post("/api-key", response_model=ApiKeyResponse)
async def update_api_key(
    api_key_data: ApiKeyUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Save or update the Hevy API key for the current user.
    The key is encrypted before storage.
    """
    current_user.hevy_api_key = encrypt_value(api_key_data.hevy_api_key)
    db.commit()
    db.refresh(current_user)
    
    return ApiKeyResponse(
        message="API key saved successfully",
        has_api_key=True
    )


@router.delete("/api-key", response_model=ApiKeyResponse)
async def delete_api_key(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Remove the Hevy API key for the current user."""
    current_user.hevy_api_key = None
    db.commit()
    db.refresh(current_user)
    
    return ApiKeyResponse(
        message="API key removed successfully",
        has_api_key=False
    )


@router.post("/yazio", response_model=YazioCredentialsResponse)
async def update_yazio_credentials(
    creds: YazioCredentialsUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Save or update Yazio credentials for the current user.
    Credentials are encrypted before storage.
    """
    current_user.yazio_email = encrypt_value(creds.yazio_email)
    current_user.yazio_password = encrypt_value(creds.yazio_password)
    db.commit()
    db.refresh(current_user)

    return YazioCredentialsResponse(
        message="Yazio credentials saved successfully",
        has_yazio=True
    )


@router.delete("/yazio", response_model=YazioCredentialsResponse)
async def delete_yazio_credentials(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Remove Yazio credentials for the current user."""
    current_user.yazio_email = None
    current_user.yazio_password = None
    db.commit()
    db.refresh(current_user)

    return YazioCredentialsResponse(
        message="Yazio credentials removed successfully",
        has_yazio=False
    )


@router.post("/goal", response_model=GoalResponse)
async def update_goal(
    data: GoalUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update the user's fitness goal and optional target weight."""
    current_user.current_goal = data.current_goal
    current_user.target_weight = data.target_weight
    db.commit()
    db.refresh(current_user)

    return GoalResponse(
        message="Goal updated successfully",
        current_goal=current_user.current_goal,
        target_weight=current_user.target_weight,
    )


@router.post("/language", response_model=LanguageResponse)
async def update_language(
    data: LanguageUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update the user's preferred language (de or en)."""
    current_user.language = data.language
    db.commit()
    db.refresh(current_user)

    return LanguageResponse(
        message="Language updated successfully",
        language=current_user.language,
    )
