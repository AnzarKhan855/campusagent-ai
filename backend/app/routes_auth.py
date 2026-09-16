from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Depends, status
from app.models import UserSignup, UserLogin
from app.database import users_collection
from app.auth import hash_password, verify_password, create_access_token, get_current_user

router = APIRouter(
    prefix="/api/auth",
    tags=["Authentication"]
)


@router.post("/signup")
async def signup(user: UserSignup):
    existing_user = await users_collection.find_one({"email": user.email.lower()})

    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )

    name = user.name.strip()
    if not name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Name cannot be empty",
        )

    if not user.password or not user.password.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password cannot be whitespace only",
        )

    user_id = user.email.lower().strip()

    new_user = {
        "_id": user_id,
        "name": name,
        "email": user_id,
        "hashed_password": hash_password(user.password),
        "role": "student",  # Force student role to prevent privilege escalation
        "created_at": datetime.now(timezone.utc),
        "is_active": True
    }

    await users_collection.insert_one(new_user)

    access_token = create_access_token(data={"sub": user_id})

    return {
        "message": "User registered successfully",
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": user_id,
            "name": new_user["name"],
            "email": new_user["email"],
            "role": new_user["role"]
        }
    }


@router.post("/login")
async def login(user: UserLogin):
    db_user = await users_collection.find_one({"email": user.email.lower()})

    if not db_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )

    if not verify_password(user.password, db_user["hashed_password"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )

    access_token = create_access_token(data={"sub": db_user["_id"]})

    return {
        "message": "Login successful",
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": db_user["_id"],
            "name": db_user["name"],
            "email": db_user["email"],
            "role": db_user["role"]
        }
    }


@router.get("/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    return {
        "message": "Current user fetched successfully",
        "user": current_user
    }