from datetime import datetime, timezone
from math import ceil, floor

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status

from app.auth import get_current_user
from app.database import database
from app.models import AttendanceCreate, AttendanceUpdate


router = APIRouter(
    prefix="/api/attendance",
    tags=["Attendance"]
)

attendance_collection = database["attendance"]
subjects_collection = database["subjects"]


def get_user_id(current_user: dict) -> str:
    return current_user.get("_id") or current_user.get("email")


def calculate_attendance_stats(
    total_classes: int,
    attended_classes: int,
    required_percentage: float
) -> dict:
    if total_classes <= 0:
        current_percentage = 0
    else:
        current_percentage = round((attended_classes / total_classes) * 100, 2)

    if current_percentage >= required_percentage + 10:
        risk_status = "safe"
    elif current_percentage >= required_percentage:
        risk_status = "warning"
    else:
        risk_status = "danger"

    if current_percentage >= required_percentage:
        max_total_classes = floor((attended_classes * 100) / required_percentage)
        classes_can_miss = max_total_classes - total_classes
        classes_needed = 0
    else:
        classes_can_miss = 0

        if required_percentage >= 100:
            classes_needed = None
        else:
            required_classes = (
                (required_percentage * total_classes) -
                (100 * attended_classes)
            ) / (100 - required_percentage)

            classes_needed = max(0, ceil(required_classes))

    return {
        "current_percentage": current_percentage,
        "risk_status": risk_status,
        "classes_can_miss": classes_can_miss,
        "classes_needed": classes_needed
    }


def serialize_attendance(attendance: dict, subject_name: str = "Unknown Subject") -> dict:
    stats = calculate_attendance_stats(
        attendance["total_classes"],
        attendance["attended_classes"],
        attendance.get("required_percentage", 75.0)
    )

    return {
        "id": str(attendance["_id"]),
        "subject_id": attendance["subject_id"],
        "subject_name": subject_name,
        "total_classes": attendance["total_classes"],
        "attended_classes": attendance["attended_classes"],
        "required_percentage": attendance.get("required_percentage", 75.0),
        "current_percentage": stats["current_percentage"],
        "risk_status": stats["risk_status"],
        "classes_can_miss": stats["classes_can_miss"],
        "classes_needed": stats["classes_needed"],
        "user_id": attendance["user_id"],
        "created_at": attendance.get("created_at"),
        "updated_at": attendance.get("updated_at"),
    }


async def get_subject_for_user(subject_id: str, user_id: str):
    if not ObjectId.is_valid(subject_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid subject_id"
        )

    subject = await subjects_collection.find_one({
        "_id": ObjectId(subject_id),
        "user_id": user_id
    })

    if not subject:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Subject not found for this user"
        )

    return subject


def validate_attendance_numbers(total_classes: int, attended_classes: int, required_percentage: float):
    if total_classes < 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Total classes cannot be negative"
        )

    if attended_classes < 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Attended classes cannot be negative"
        )

    if attended_classes > total_classes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Attended classes cannot be greater than total classes"
        )

    if required_percentage <= 0 or required_percentage > 100:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Required percentage must be between 1 and 100"
        )


@router.post("")
async def create_attendance(
    attendance: AttendanceCreate,
    current_user: dict = Depends(get_current_user)
):
    user_id = get_user_id(current_user)

    subject = await get_subject_for_user(attendance.subject_id, user_id)

    validate_attendance_numbers(
        attendance.total_classes,
        attendance.attended_classes,
        attendance.required_percentage
    )

    existing_attendance = await attendance_collection.find_one({
        "subject_id": attendance.subject_id,
        "user_id": user_id
    })

    if existing_attendance:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Attendance already exists for this subject"
        )

    attendance_data = attendance.dict()
    attendance_data["user_id"] = user_id
    attendance_data["created_at"] = datetime.now(timezone.utc).isoformat()
    attendance_data["updated_at"] = datetime.now(timezone.utc).isoformat()

    result = await attendance_collection.insert_one(attendance_data)

    new_attendance = await attendance_collection.find_one({
        "_id": result.inserted_id
    })

    return {
        "message": "Attendance created successfully",
        "attendance": serialize_attendance(new_attendance, subject["name"])
    }


@router.get("")
async def get_attendance_records(
    current_user: dict = Depends(get_current_user)
):
    user_id = get_user_id(current_user)

    attendance_cursor = attendance_collection.find({
        "user_id": user_id
    }).sort("created_at", -1)

    attendance_records = []

    async for attendance in attendance_cursor:
        subject_name = "Unknown Subject"

        if ObjectId.is_valid(attendance["subject_id"]):
            subject = await subjects_collection.find_one({
                "_id": ObjectId(attendance["subject_id"]),
                "user_id": user_id
            })

            if subject:
                subject_name = subject["name"]

        attendance_records.append(
            serialize_attendance(attendance, subject_name)
        )

    return {
        "message": "Attendance records fetched successfully",
        "count": len(attendance_records),
        "attendance": attendance_records
    }


@router.put("/{attendance_id}")
async def update_attendance(
    attendance_id: str,
    attendance_update: AttendanceUpdate,
    current_user: dict = Depends(get_current_user)
):
    user_id = get_user_id(current_user)

    if not ObjectId.is_valid(attendance_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid attendance_id"
        )

    existing_attendance = await attendance_collection.find_one({
        "_id": ObjectId(attendance_id),
        "user_id": user_id
    })

    if not existing_attendance:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Attendance record not found"
        )

    update_data = attendance_update.dict(exclude_unset=True)

    total_classes = update_data.get(
        "total_classes",
        existing_attendance["total_classes"]
    )

    attended_classes = update_data.get(
        "attended_classes",
        existing_attendance["attended_classes"]
    )

    required_percentage = update_data.get(
        "required_percentage",
        existing_attendance.get("required_percentage", 75.0)
    )

    validate_attendance_numbers(
        total_classes,
        attended_classes,
        required_percentage
    )

    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()

    await attendance_collection.update_one(
        {
            "_id": ObjectId(attendance_id),
            "user_id": user_id
        },
        {
            "$set": update_data
        }
    )

    updated_attendance = await attendance_collection.find_one({
        "_id": ObjectId(attendance_id),
        "user_id": user_id
    })

    subject_name = "Unknown Subject"

    if ObjectId.is_valid(updated_attendance["subject_id"]):
        subject = await subjects_collection.find_one({
            "_id": ObjectId(updated_attendance["subject_id"]),
            "user_id": user_id
        })

        if subject:
            subject_name = subject["name"]

    return {
        "message": "Attendance updated successfully",
        "attendance": serialize_attendance(updated_attendance, subject_name)
    }


@router.delete("/{attendance_id}")
async def delete_attendance(
    attendance_id: str,
    current_user: dict = Depends(get_current_user)
):
    user_id = get_user_id(current_user)

    if not ObjectId.is_valid(attendance_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid attendance_id"
        )

    result = await attendance_collection.delete_one({
        "_id": ObjectId(attendance_id),
        "user_id": user_id
    })

    if result.deleted_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Attendance record not found"
        )

    return {
        "message": "Attendance deleted successfully"
    }