"""
User routes for profile and API key management.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import User
from app.schemas import UserResponse, ApiKeyUpdate, ApiKeyResponse
from app.dependencies import get_current_user

router = APIRouter(prefix="/user", tags=["User"])


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(current_user: User = Depends(get_current_user)):
    """
    Get current authenticated user's information.
    
    Returns user profile excluding sensitive data like password.
    """
    return UserResponse(
        id=current_user.id,
        username=current_user.username,
        has_api_key=current_user.hevy_api_key is not None
    )


@router.post("/api-key", response_model=ApiKeyResponse)
async def update_api_key(
    api_key_data: ApiKeyUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Save or update the Hevy API key for the current user.
    
    - **hevy_api_key**: Your personal Hevy API key
    """
    # Update the user's API key
    current_user.hevy_api_key = api_key_data.hevy_api_key
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
    """
    Remove the Hevy API key for the current user.
    """
    current_user.hevy_api_key = None
    db.commit()
    db.refresh(current_user)
    
    return ApiKeyResponse(
        message="API key removed successfully",
        has_api_key=False
    )
