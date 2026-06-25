from fastapi import APIRouter, Depends, HTTPException
from datetime import datetime, date
from bson import ObjectId
import traceback

from app.auth import get_current_user
from app.database import subjects_collection, assignments_collection, attendance_collection

router = APIRouter(prefix="/api/dashboard", tags=["Dashboard"])


def get_user_id(current_user) -> str:
    if isinstance(current_user, dict):
        return str(
            current_user.get("_id")
            or current_user.get("email")
            or current_user.get("id")
            or current_user.get("sub")
        )

    return str(current_user)


def safe_int(value, default=0):
    try:
        if value is None or value == "":
            return default
        return int(value)
    except Exception:
        return default


def safe_float(value, default=0):
    try:
        if value is None or value == "":
            return default
        return float(value)
    except Exception:
        return default


def safe_str(value):
    if value is None:
        return None

    if isinstance(value, ObjectId):
        return str(value)

    return str(value)


def parse_due_date(value):
    if not value:
        return None

    if isinstance(value, datetime):
        return value.date()

    if isinstance(value, date):
        return value

    if isinstance(value, str):
        try:
            return datetime.strptime(value[:10], "%Y-%m-%d").date()
        except Exception:
            return None

    return None


def format_due_date(value):
    parsed = parse_due_date(value)

    if parsed:
        return parsed.isoformat()

    return None


@router.get("/overview")
async def get_dashboard_overview(current_user=Depends(get_current_user)):
    try:
        user_id = get_user_id(current_user)
        today = date.today()

        subjects = await subjects_collection.find(
            {"user_id": user_id}
        ).to_list(length=None)

        assignments = await assignments_collection.find(
            {"user_id": user_id}
        ).to_list(length=None)

        attendance_records = await attendance_collection.find(
            {"user_id": user_id}
        ).to_list(length=None)

        total_subjects = len(subjects)
        total_assignments = len(assignments)

        pending_assignments = 0
        completed_assignments = 0
        overdue_assignments = 0
        upcoming_assignments = []

        for assignment in assignments:
            status = str(assignment.get("status", "")).lower().strip()
            due_date = parse_due_date(assignment.get("due_date"))

            if status == "completed":
                completed_assignments += 1
                continue

            pending_assignments += 1

            if due_date and due_date < today:
                overdue_assignments += 1

            if due_date and due_date >= today:
                upcoming_assignments.append({
                    "id": safe_str(assignment.get("_id")),
                    "title": assignment.get("title"),
                    "due_date": format_due_date(assignment.get("due_date")),
                    "priority": assignment.get("priority"),
                    "status": assignment.get("status"),
                    "subject_id": safe_str(assignment.get("subject_id")),
                })

        upcoming_assignments = sorted(
            upcoming_assignments,
            key=lambda item: item.get("due_date") or ""
        )[:5]

        total_classes_held = 0
        total_classes_attended = 0
        danger_attendance_count = 0

        for record in attendance_records:
            classes_held = safe_int(
                record.get("classes_held")
                or record.get("total_classes")
                or record.get("classesHeld")
                or record.get("held")
                or record.get("classes_held_so_far"),
                0
            )

            classes_attended = safe_int(
                record.get("classes_attended")
                or record.get("attended_classes")
                or record.get("classesAttended")
                or record.get("attended")
                or record.get("classes_attended_so_far"),
                0
            )

            required_percentage = safe_float(
                record.get("required_percentage")
                or record.get("required_percent")
                or record.get("requiredPercentage")
                or record.get("minimum_percentage")
                or record.get("required"),
                75
            )

            total_classes_held += classes_held
            total_classes_attended += classes_attended

            current_percentage = 0

            if classes_held > 0:
                current_percentage = (classes_attended / classes_held) * 100

            if classes_held > 0 and current_percentage < required_percentage:
                danger_attendance_count += 1

        overall_attendance = 0

        if total_classes_held > 0:
            overall_attendance = round(
                (total_classes_attended / total_classes_held) * 100,
                2
            )

        return {
            "message": "Dashboard overview fetched successfully",
            "overview": {
                "total_subjects": total_subjects,
                "total_assignments": total_assignments,
                "pending_assignments": pending_assignments,
                "completed_assignments": completed_assignments,
                "overdue_assignments": overdue_assignments,
                "overall_attendance": overall_attendance,
                "danger_attendance_count": danger_attendance_count,
                "total_attendance_records": len(attendance_records),
                "total_classes_held": total_classes_held,
                "total_classes_attended": total_classes_attended,
                "upcoming_assignments": upcoming_assignments,
            }
        }

    except Exception as error:
        print("DASHBOARD OVERVIEW ERROR:")
        print(traceback.format_exc())

        raise HTTPException(
            status_code=500,
            detail=str(error)
        )