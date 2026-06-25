from datetime import datetime, timezone

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status

from app.auth import get_current_user
from app.database import subjects_collection
from app.models import SubjectCreate


router = APIRouter(
    prefix="/api/subjects",
    tags=["Subjects"]
)


def get_user_id(current_user):
    if isinstance(current_user, dict):
        return current_user.get("_id") or current_user.get("email")

    return getattr(current_user, "_id", None) or getattr(current_user, "email", None)


def serialize_subject(subject):
    return {
        "id": str(subject["_id"]),
        "user_id": subject.get("user_id"),
        "name": subject.get("name"),
        "code": subject.get("code"),
        "teacher": subject.get("teacher"),
        "color": subject.get("color", "blue"),
        "created_at": subject.get("created_at"),
        "updated_at": subject.get("updated_at"),
    }


@router.post("")
async def add_subject(
    subject: SubjectCreate,
    current_user=Depends(get_current_user)
):
    user_id = get_user_id(current_user)

    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid user authentication"
        )

    now = datetime.now(timezone.utc)

    subject_data = {
        "user_id": user_id,
        "name": subject.name.strip(),
        "code": subject.code.strip() if subject.code else None,
        "teacher": subject.teacher.strip() if subject.teacher else None,
        "color": subject.color or "blue",
        "created_at": now,
        "updated_at": now,
    }

    result = await subjects_collection.insert_one(subject_data)

    created_subject = await subjects_collection.find_one(
        {"_id": result.inserted_id}
    )

    return {
        "message": "Subject added successfully",
        "subject": serialize_subject(created_subject)
    }


@router.get("")
async def get_subjects(
    current_user=Depends(get_current_user)
):
    user_id = get_user_id(current_user)

    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid user authentication"
        )

    cursor = subjects_collection.find(
        {"user_id": user_id}
    ).sort("created_at", -1)

    subjects_list = await cursor.to_list(length=100)

    subjects = [serialize_subject(subject) for subject in subjects_list]

    return {
        "message": "Subjects fetched successfully",
        "count": len(subjects),
        "subjects": subjects
    }


@router.delete("/{subject_id}")
async def delete_subject(
    subject_id: str,
    current_user=Depends(get_current_user)
):
    user_id = get_user_id(current_user)

    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid user authentication"
        )

    if not ObjectId.is_valid(subject_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid subject id"
        )

    subject = await subjects_collection.find_one(
        {
            "_id": ObjectId(subject_id),
            "user_id": user_id
        }
    )

    if not subject:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Subject not found"
        )

    await subjects_collection.delete_one(
        {
            "_id": ObjectId(subject_id),
            "user_id": user_id
        }
    )

    return {
        "message": "Subject deleted successfully",
        "subject_id": subject_id
    }