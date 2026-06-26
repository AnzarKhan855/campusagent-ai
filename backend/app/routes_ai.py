import os
from datetime import datetime, date, timezone
from pathlib import Path
from typing import Any, Optional

from dotenv import load_dotenv
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.auth import get_current_user

try:
    from groq import AsyncGroq
except ImportError:
    AsyncGroq = None

try:
    from app.database import database as db
except ImportError:
    from app.database import db


BASE_DIR = Path(__file__).resolve().parents[1]
load_dotenv(BASE_DIR / ".env", override=True)

router = APIRouter(prefix="/api/ai", tags=["AI Command Agent"])

MAX_PDF_CHARS = 3000
MAX_ASSIGNMENTS_FOR_AI = 5


class AICommandRequest(BaseModel):
    command: str


def get_user_id(current_user: dict) -> str:
    return str(
        current_user.get("_id")
        or current_user.get("id")
        or current_user.get("email")
    )


def parse_due_date(value: Any) -> Optional[date]:
    if not value:
        return None

    if isinstance(value, datetime):
        return value.date()

    if isinstance(value, date):
        return value

    if isinstance(value, str):
        try:
            return datetime.fromisoformat(value.replace("Z", "+00:00")).date()
        except ValueError:
            return None

    return None


def format_due_date(value: Any) -> str:
    if not value:
        return "No due date"

    if isinstance(value, datetime):
        return value.date().isoformat()

    if isinstance(value, date):
        return value.isoformat()

    return str(value)


def safe_int(value: Any, default: int = 0) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def safe_float(value: Any, default: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def get_classes_held(record: dict) -> int:
    return safe_int(
        record.get("total_classes")
        or record.get("classes_held")
        or record.get("held_classes")
        or 0
    )


def get_classes_attended(record: dict) -> int:
    return safe_int(
        record.get("attended_classes")
        or record.get("classes_attended")
        or record.get("present_classes")
        or 0
    )


def calculate_attendance_percentage(held: int, attended: int) -> float:
    if held <= 0:
        return 0.0

    return round((attended / held) * 100, 2)


def get_subject_name(subject_id: Any, subjects_map: dict) -> str:
    if not subject_id:
        return "Unknown Subject"

    return subjects_map.get(str(subject_id), "Unknown Subject")


def get_assignment_subject(assignment: dict, subjects_map: dict) -> str:
    subject_id = assignment.get("subject_id")

    if subject_id:
        subject_name = get_subject_name(subject_id, subjects_map)

        if subject_name != "Unknown Subject":
            return subject_name

    return (
        assignment.get("subject")
        or assignment.get("subject_name")
        or "Unknown Subject"
    )


def get_attendance_subject(record: dict, subjects_map: dict) -> str:
    return (
        record.get("subject_name")
        or record.get("subject")
        or get_subject_name(record.get("subject_id"), subjects_map)
    )


def get_assignment_details(assignment: dict) -> str:
    return (
        assignment.get("details")
        or assignment.get("description")
        or assignment.get("topic")
        or assignment.get("assignment_details")
        or "No assignment details provided."
    )


def get_assignment_pdf_filename(assignment: dict) -> str:
    return (
        assignment.get("pdf_filename")
        or assignment.get("file_name")
        or assignment.get("filename")
        or "No PDF uploaded"
    )


def get_assignment_pdf_text(assignment: dict) -> str:
    return (
        assignment.get("pdf_text")
        or assignment.get("extracted_text")
        or assignment.get("parsed_text")
        or assignment.get("pdf_content")
        or assignment.get("file_text")
        or ""
    )


async def fetch_student_data(user_id: str):
    subjects = await db.subjects.find({"user_id": user_id}).to_list(length=None)
    assignments = await db.assignments.find({"user_id": user_id}).to_list(length=None)
    attendance_records = await db.attendance.find({"user_id": user_id}).to_list(
        length=None
    )

    subjects_map = {
        str(subject.get("_id")): subject.get("name", "Unknown Subject")
        for subject in subjects
    }

    return subjects, assignments, attendance_records, subjects_map


def build_rule_based_plan(
    subjects: list,
    assignments: list,
    attendance_records: list,
    subjects_map: dict,
):
    today = datetime.now(timezone.utc).date()

    pending_assignments = []
    urgent_assignments = []
    overdue_assignments = []

    for assignment in assignments:
        status = str(assignment.get("status", "pending")).lower()

        if status == "completed":
            continue

        due_date = parse_due_date(assignment.get("due_date"))
        days_left = (due_date - today).days if due_date else None

        assignment_data = {
            "title": assignment.get("title", "Untitled Assignment"),
            "subject": get_assignment_subject(assignment, subjects_map),
            "due_date": format_due_date(assignment.get("due_date")),
            "priority": assignment.get("priority", "medium"),
            "status": assignment.get("status", "pending"),
            "days_left": days_left,
        }

        pending_assignments.append(assignment_data)

        if days_left is not None:
            if days_left < 0:
                overdue_assignments.append(assignment_data)
            elif days_left <= 3:
                urgent_assignments.append(assignment_data)

    danger_attendance = []

    for record in attendance_records:
        classes_held = get_classes_held(record)
        classes_attended = get_classes_attended(record)
        required_percentage = safe_float(record.get("required_percentage"), 75)

        percentage = record.get("current_percentage")

        if percentage is None:
            percentage = calculate_attendance_percentage(
                classes_held,
                classes_attended,
            )
        else:
            percentage = safe_float(percentage)

        if classes_held > 0 and percentage < required_percentage:
            danger_attendance.append(
                {
                    "subject": get_attendance_subject(record, subjects_map),
                    "attendance_percentage": percentage,
                    "required_percentage": required_percentage,
                    "classes_held": classes_held,
                    "classes_attended": classes_attended,
                }
            )

    priority_weight = {"high": 1, "medium": 2, "low": 3}

    pending_assignments.sort(
        key=lambda item: (
            item["days_left"] if item["days_left"] is not None else 9999,
            priority_weight.get(str(item["priority"]).lower(), 2),
        )
    )

    suggested_study_order = []

    for assignment in pending_assignments[:3]:
        suggested_study_order.append(
            f"Complete/revise {assignment['subject']} for assignment: {assignment['title']}"
        )

    for attendance in danger_attendance[:2]:
        suggested_study_order.append(
            f"Attend upcoming {attendance['subject']} classes to improve attendance"
        )

    if not suggested_study_order and subjects:
        suggested_study_order.append(
            f"Revise your subject: {subjects[0].get('name', 'your main subject')}"
        )

    if overdue_assignments:
        todays_priority = (
            f"Finish overdue assignment first: {overdue_assignments[0]['title']}"
        )
    elif urgent_assignments:
        todays_priority = f"Focus on upcoming deadline: {urgent_assignments[0]['title']}"
    elif danger_attendance:
        todays_priority = f"Improve attendance in {danger_attendance[0]['subject']}"
    elif pending_assignments:
        todays_priority = f"Work on assignment: {pending_assignments[0]['title']}"
    else:
        todays_priority = "Revise your subjects and keep your academic workflow clean."

    return {
        "success": True,
        "agent_type": "rule_based_v1",
        "plan": {
            "todays_priority": todays_priority,
            "urgent_assignments": urgent_assignments,
            "overdue_assignments": overdue_assignments,
            "attendance_danger_warning": danger_attendance,
            "suggested_study_order": suggested_study_order,
            "short_motivation": "Small consistent progress beats last-minute panic. Handle the most urgent task first.",
        },
        "summary": {
            "total_subjects": len(subjects),
            "pending_assignments": len(pending_assignments),
            "urgent_assignments": len(urgent_assignments),
            "overdue_assignments": len(overdue_assignments),
            "danger_attendance_subjects": len(danger_attendance),
        },
    }


def build_student_context(
    subjects: list,
    assignments: list,
    attendance_records: list,
    subjects_map: dict,
) -> str:
    subject_lines = [
        f"- {subject.get('name', 'Unknown Subject')}" for subject in subjects
    ]

    assignment_lines = []

    for assignment in assignments[:MAX_ASSIGNMENTS_FOR_AI]:
        pdf_filename = get_assignment_pdf_filename(assignment)
        pdf_text = get_assignment_pdf_text(assignment).strip()
        has_pdf = bool(pdf_text)

        pdf_preview = (
            pdf_text[:MAX_PDF_CHARS]
            if has_pdf
            else "No PDF text available for this assignment."
        )

        if has_pdf and len(pdf_text) > MAX_PDF_CHARS:
            pdf_preview += "\n[PDF text shortened for faster AI response.]"

        assignment_lines.append(
            f"""
- Title: {assignment.get('title', 'Untitled Assignment')}
  Subject: {get_assignment_subject(assignment, subjects_map)}
  Details/Topic: {get_assignment_details(assignment)}
  Due Date: {format_due_date(assignment.get('due_date'))}
  Priority: {assignment.get('priority', 'medium')}
  Status: {assignment.get('status', 'pending')}
  Uploaded PDF Filename: {pdf_filename}
  Has Uploaded PDF Text: {has_pdf}
  PDF Extracted Text Preview:
  {pdf_preview}
"""
        )

    attendance_lines = []

    for record in attendance_records:
        classes_held = get_classes_held(record)
        classes_attended = get_classes_attended(record)
        required_percentage = safe_float(record.get("required_percentage"), 75)

        percentage = record.get("current_percentage")

        if percentage is None:
            percentage = calculate_attendance_percentage(
                classes_held,
                classes_attended,
            )
        else:
            percentage = safe_float(percentage)

        attendance_lines.append(
            "- "
            f"Subject: {get_attendance_subject(record, subjects_map)}; "
            f"Attendance: {percentage}%; "
            f"Required: {required_percentage}%; "
            f"Attended: {classes_attended}; "
            f"Held: {classes_held}"
        )

    subjects_text = "\n".join(subject_lines) if subject_lines else "No subjects found."
    assignments_text = (
        "\n".join(assignment_lines) if assignment_lines else "No assignments found."
    )
    attendance_text = (
        "\n".join(attendance_lines)
        if attendance_lines
        else "No attendance records found."
    )

    return f"""
Student Academic Context

Subjects:
{subjects_text}

Assignments and Uploaded PDF Context:
{assignments_text}

Attendance:
{attendance_text}
"""


async def run_groq_agent(
    command: str,
    subjects: list,
    assignments: list,
    attendance_records: list,
    subjects_map: dict,
):
    if AsyncGroq is None:
        raise HTTPException(
            status_code=500,
            detail="Groq package is not installed. Run: pip install groq",
        )

    api_key = os.getenv("GROQ_API_KEY", "").strip()

    if not api_key:
        raise HTTPException(
            status_code=500,
            detail="GROQ_API_KEY is missing in backend environment variables",
        )

    model = os.getenv("GROQ_MODEL", "llama-3.1-8b-instant").strip()
    client = AsyncGroq(api_key=api_key)

    student_context = build_student_context(
        subjects,
        assignments,
        attendance_records,
        subjects_map,
    )

    system_prompt = f"""
You are CampusAgent AI, a helpful academic productivity assistant for B.Tech students.

You help students with:
- assignment preparation
- study planning
- topic explanation
- deadline prioritization
- attendance-aware academic advice
- breaking assignments into simple steps
- generating outlines, checklists, and learning roadmaps
- explaining uploaded assignment PDFs
- extracting important questions from uploaded PDFs
- making preparation plans based on uploaded PDFs

Academic honesty rules:
- Do not write a full assignment for direct submission.
- Do not help with cheating or plagiarism.
- Guide the student with explanations, structure, examples, steps, and draft outlines.

PDF rules:
1. If the user asks about uploaded PDF, use the PDF extracted text from the assignment context.
2. If PDF text is available, say: "Based on your uploaded PDF..."
3. If PDF text is not available, say that no PDF text is available.
4. Do not pretend to read a PDF if extracted text is missing.
5. Keep answers concise and practical.

Attendance rules:
1. Use the Attendance section from Student Academic Context.
2. Do not say attendance is 0% unless the provided context says 0%.
3. If attendance is below required percentage, clearly mention the subject and current percentage.
4. If attendance is above required percentage, say it is currently safe.
5. Give practical advice based on current attendance.

Student data:
{student_context}

Response style:
- Use clear headings.
- Use bullet points.
- Give step-by-step guidance.
- Keep the answer useful and concise.
"""

    try:
        completion = await client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": command},
            ],
            temperature=0.3,
            max_tokens=700,
        )

        answer = completion.choices[0].message.content

        return {
            "success": True,
            "agent_type": "groq_llm_v1",
            "command": command,
            "answer": answer,
        }

    except Exception as error:
        raise HTTPException(status_code=500, detail=f"Groq AI error: {str(error)}")


@router.post("/command")
async def run_ai_command(
    request: AICommandRequest,
    current_user: dict = Depends(get_current_user),
):
    user_id = get_user_id(current_user)
    original_command = request.command.strip()
    command = original_command.lower()

    if not original_command:
        raise HTTPException(status_code=400, detail="Command is required")

    subjects, assignments, attendance_records, subjects_map = await fetch_student_data(
        user_id
    )

    plan_commands = [
        "plan my day",
        "plan today",
        "today plan",
        "make my day plan",
        "make a plan for today",
    ]

    attendance_commands = [
        "check my attendance",
        "check my attendance risk",
        "attendance risk",
        "show attendance",
        "my attendance",
    ]

    if command in plan_commands or command in attendance_commands:
        rule_based_result = build_rule_based_plan(
            subjects,
            assignments,
            attendance_records,
            subjects_map,
        )
        return {**rule_based_result, "command": request.command}

    return await run_groq_agent(
        original_command,
        subjects,
        assignments,
        attendance_records,
        subjects_map,
    )