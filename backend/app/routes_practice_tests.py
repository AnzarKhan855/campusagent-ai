import json
import os
import random
import re
from datetime import datetime, timezone
from typing import Any, Optional

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

try:
    from groq import AsyncGroq
except Exception:
    AsyncGroq = None

from app.auth import get_current_user
from app.database import database


router = APIRouter(tags=["Practice Tests"])

assignments_collection = database["assignments"]
practice_tests_collection = database["practice_tests"]


class PracticeTestCreateRequest(BaseModel):
    title: Optional[str] = "Practice Test"
    question_count: Optional[int] = 10
    difficulty_filter: Optional[str] = "all"
    topic_filter: Optional[str] = "all"
    important_only: Optional[bool] = False


class PracticeAnswerUpdate(BaseModel):
    question_index: int
    student_answer: str


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def get_user_id(current_user: dict) -> str:
    return str(
        current_user.get("_id")
        or current_user.get("id")
        or current_user.get("email")
    )


def normalize_score(value: Any) -> int:
    if value is None:
        return 0

    match = re.search(r"\d+(\.\d+)?", str(value))

    if not match:
        return 0

    score = round(float(match.group(0)))
    return max(0, min(10, score))


def normalize_text_list(value: Any) -> list[str]:
    if value is None:
        return []

    if isinstance(value, list):
        return [str(item).strip() for item in value if str(item).strip()]

    if isinstance(value, str):
        parts = re.split(r"\n|;", value)
        return [
            part.strip(" -•\t\r\n")
            for part in parts
            if part.strip(" -•\t\r\n")
        ]

    return [str(value).strip()]


def clean_ai_text(value: Any) -> str:
    text = str(value or "").strip()
    text = text.replace("\\*", "*")
    text = text.replace("\\_", "_")
    text = text.replace("\\(", "(")
    text = text.replace("\\)", ")")
    text = text.replace("\\[", "[")
    text = text.replace("\\]", "]")
    return text.strip()


def extract_json_from_ai_response(text: str) -> dict:
    if not text:
        raise ValueError("Empty AI response")

    cleaned = text.strip()
    cleaned = cleaned.replace("```json", "").replace("```", "").strip()
    cleaned = cleaned.replace("“", '"').replace("”", '"')
    cleaned = cleaned.replace("‘", "'").replace("’", "'")

    start_index = cleaned.find("{")

    if start_index == -1:
        raise ValueError("No JSON object found in AI response")

    depth = 0
    end_index = -1
    inside_string = False
    escape_next = False

    for index in range(start_index, len(cleaned)):
        character = cleaned[index]

        if inside_string:
            if escape_next:
                escape_next = False
            elif character == "\\":
                escape_next = True
            elif character == '"':
                inside_string = False
        else:
            if character == '"':
                inside_string = True
            elif character == "{":
                depth += 1
            elif character == "}":
                depth -= 1

                if depth == 0:
                    end_index = index + 1
                    break

    if end_index == -1:
        raise ValueError("Could not find complete JSON object in AI response")

    json_text = cleaned[start_index:end_index].strip()

    try:
        return json.loads(json_text)
    except Exception:
        repaired_json_text = json_text

        repaired_json_text = re.sub(
            r'\\(?!["\\/bfnrtu])',
            "",
            repaired_json_text,
        )

        repaired_json_text = re.sub(
            r",\s*([}\]])",
            r"\1",
            repaired_json_text,
        )

        return json.loads(repaired_json_text, strict=False)


def fallback_extract_score(raw_text: str) -> int:
    score_patterns = [
        r'"ai_score"\s*:\s*"?(\d+)',
        r"ai_score\s*:\s*'?(\d+)",
        r"score\s*:\s*'?(\d+)",
        r"(\d+)\s*/\s*10",
    ]

    for pattern in score_patterns:
        match = re.search(pattern, raw_text, flags=re.IGNORECASE)

        if match:
            return normalize_score(match.group(1))

    return 0


def safe_difficulty(value: Any) -> str:
    difficulty = str(value or "medium").strip().lower()

    if difficulty in {"easy", "medium", "hard"}:
        return difficulty

    return "medium"


def safe_topic(value: Any) -> str:
    topic = str(value or "").strip()

    if not topic:
        return "General"

    return topic[:50]


def calculate_test_percentage(test: dict) -> int:
    questions = test.get("questions", [])
    max_score = len(questions) * 10

    if max_score <= 0:
        return 0

    total_score = int(test.get("total_score", 0) or 0)
    return round((total_score / max_score) * 100)


async def evaluate_practice_answer_with_groq(
    question_text: str,
    student_answer: str,
    pdf_context: str = "",
    topic_tag: str = "",
    difficulty: str = "medium",
) -> dict:
    if AsyncGroq is None:
        raise HTTPException(
            status_code=500,
            detail="Groq package is not installed. Run: pip install groq",
        )

    api_key = os.getenv("GROQ_API_KEY", "").strip()

    if not api_key:
        raise HTTPException(
            status_code=500,
            detail="GROQ_API_KEY is missing in backend .env file",
        )

    model = os.getenv("GROQ_MODEL", "llama-3.1-8b-instant").strip()
    client = AsyncGroq(api_key=api_key)

    system_prompt = """
You are CampusAgent AI, an academic practice test evaluator for B.Tech students.

Return ONLY valid JSON in this exact format:

{
  "ai_score": 7,
  "ai_feedback": "Short feedback.",
  "strengths": ["point 1", "point 2"],
  "missing_points": ["point 1", "point 2"],
  "model_answer": "A clear exam-ready answer."
}

Rules:
- Score must be from 0 to 10.
- Be strict but helpful.
- Evaluate like a semester exam answer.
- Do not return markdown.
- Do not return LaTeX.
- Do not use escaped characters like backslash-star.
- Use plain text formulas only.
- Do not return extra text outside JSON.
"""

    user_prompt = f"""
Question:
{question_text}

Topic:
{topic_tag}

Difficulty:
{difficulty}

Student Answer:
{student_answer}

PDF Context:
{pdf_context[:1800]}
"""

    try:
        completion = await client.chat.completions.create(
            model=model,
            messages=[
                {
                    "role": "system",
                    "content": system_prompt,
                },
                {
                    "role": "user",
                    "content": user_prompt,
                },
            ],
            temperature=0.25,
            max_tokens=900,
        )

        raw_answer = completion.choices[0].message.content or ""

        try:
            parsed = extract_json_from_ai_response(raw_answer)

            return {
                "ai_score": normalize_score(parsed.get("ai_score")),
                "ai_feedback": clean_ai_text(parsed.get("ai_feedback", "")),
                "strengths": normalize_text_list(parsed.get("strengths")),
                "missing_points": normalize_text_list(parsed.get("missing_points")),
                "model_answer": clean_ai_text(parsed.get("model_answer", "")),
            }

        except Exception:
            fallback_score = fallback_extract_score(raw_answer)

            return {
                "ai_score": fallback_score,
                "ai_feedback": clean_ai_text(raw_answer),
                "strengths": [],
                "missing_points": [],
                "model_answer": "",
            }

    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"Groq practice test evaluation error: {str(error)}",
        )


async def serialize_practice_test(test: dict) -> dict:
    questions = test.get("questions", [])

    answered_count = sum(
        1
        for question in questions
        if str(question.get("student_answer", "")).strip()
    )

    evaluated_count = sum(
        1
        for question in questions
        if question.get("ai_score") is not None
    )

    max_score = len(questions) * 10
    total_score = int(test.get("total_score", 0) or 0)

    percentage = (
        round((total_score / max_score) * 100)
        if max_score > 0
        else 0
    )

    return {
        "id": str(test["_id"]),
        "_id": str(test["_id"]),
        "assignment_id": test.get("assignment_id", ""),
        "user_id": test.get("user_id", ""),
        "title": test.get("title", "Practice Test"),
        "status": test.get("status", "in_progress"),
        "mode": test.get("mode", "custom"),
        "difficulty_filter": test.get("difficulty_filter", "all"),
        "topic_filter": test.get("topic_filter", "all"),
        "important_only": test.get("important_only", False),
        "questions": questions,
        "questions_count": len(questions),
        "answered_count": answered_count,
        "evaluated_count": evaluated_count,
        "total_score": total_score,
        "max_score": max_score,
        "percentage": percentage,
        "weak_topics": test.get("weak_topics", []),
        "created_at": test.get("created_at", ""),
        "started_at": test.get("started_at", ""),
        "updated_at": test.get("updated_at", ""),
        "submitted_at": test.get("submitted_at", ""),
    }


@router.post("/api/assignments/{assignment_id}/practice-tests/create")
async def create_practice_test(
    assignment_id: str,
    request: PracticeTestCreateRequest,
    current_user: dict = Depends(get_current_user),
):
    user_id = get_user_id(current_user)

    if not ObjectId.is_valid(assignment_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid assignment_id",
        )

    assignment = await assignments_collection.find_one(
        {
            "_id": ObjectId(assignment_id),
            "user_id": user_id,
        }
    )

    if not assignment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assignment not found",
        )

    assignment_questions = assignment.get("questions", [])

    if not assignment_questions:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No extracted questions found. Please extract questions first.",
        )

    difficulty_filter = str(request.difficulty_filter or "all").strip().lower()
    topic_filter = str(request.topic_filter or "all").strip()
    important_only = bool(request.important_only)

    selected_questions = []

    for original_index, question in enumerate(assignment_questions):
        question_text = str(question.get("question", "")).strip()

        if not question_text:
            continue

        question_difficulty = safe_difficulty(question.get("difficulty"))
        question_topic = safe_topic(question.get("topic_tag"))
        is_important = bool(question.get("is_important", False))

        if difficulty_filter != "all" and question_difficulty != difficulty_filter:
            continue

        if (
            topic_filter.lower() != "all"
            and question_topic.lower() != topic_filter.lower()
        ):
            continue

        if important_only and not is_important:
            continue

        selected_questions.append(
            {
                "source_question_index": original_index,
                "question": question_text,
                "topic_tag": question_topic,
                "difficulty": question_difficulty,
                "is_important": is_important,
                "student_answer": "",
                "ai_score": None,
                "ai_feedback": "",
                "strengths": [],
                "missing_points": [],
                "model_answer": "",
                "evaluated_at": "",
            }
        )

    if not selected_questions:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No questions matched your filters. Try all difficulty/topic.",
        )

    question_count = int(request.question_count or 10)
    question_count = max(1, min(question_count, len(selected_questions), 50))

    if len(selected_questions) > question_count:
        selected_questions = random.sample(selected_questions, question_count)

    practice_questions = []

    for test_index, question in enumerate(selected_questions):
        practice_questions.append(
            {
                "question_index": test_index,
                **question,
            }
        )

    current_time = now_iso()

    title = str(request.title or "").strip()

    if not title:
        title = f"{assignment.get('title', 'Assignment')} Practice Test"

    test_data = {
        "assignment_id": assignment_id,
        "user_id": user_id,
        "title": title,
        "status": "in_progress",
        "mode": "custom",
        "difficulty_filter": difficulty_filter,
        "topic_filter": topic_filter,
        "important_only": important_only,
        "questions": practice_questions,
        "total_score": 0,
        "weak_topics": [],
        "created_at": current_time,
        "started_at": current_time,
        "updated_at": current_time,
        "submitted_at": "",
    }

    result = await practice_tests_collection.insert_one(test_data)

    new_test = await practice_tests_collection.find_one(
        {
            "_id": result.inserted_id,
            "user_id": user_id,
        }
    )

    return {
        "success": True,
        "message": "Practice test created successfully",
        "test": await serialize_practice_test(new_test),
    }


@router.get("/api/assignments/{assignment_id}/practice-tests")
async def get_assignment_practice_tests(
    assignment_id: str,
    current_user: dict = Depends(get_current_user),
):
    user_id = get_user_id(current_user)

    if not ObjectId.is_valid(assignment_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid assignment_id",
        )

    tests_cursor = practice_tests_collection.find(
        {
            "assignment_id": assignment_id,
            "user_id": user_id,
        }
    ).sort("created_at", -1)

    tests = []

    async for test in tests_cursor:
        tests.append(await serialize_practice_test(test))

    return {
        "success": True,
        "message": "Practice tests fetched successfully",
        "count": len(tests),
        "tests": tests,
    }


@router.get("/api/practice-tests/analytics/dashboard-summary")
async def get_practice_test_dashboard_summary(
    current_user: dict = Depends(get_current_user),
):
    user_id = get_user_id(current_user)

    tests_cursor = practice_tests_collection.find(
        {
            "user_id": user_id,
        }
    ).sort("created_at", -1)

    tests = []

    async for test in tests_cursor:
        tests.append(test)

    total_tests = len(tests)

    submitted_tests_list = [
        test for test in tests if test.get("status") == "submitted"
    ]

    submitted_tests = len(submitted_tests_list)
    in_progress_tests = total_tests - submitted_tests

    percentages = [
        calculate_test_percentage(test)
        for test in submitted_tests_list
    ]

    average_percentage = (
        round(sum(percentages) / len(percentages))
        if percentages
        else 0
    )

    best_percentage = max(percentages) if percentages else 0
    lowest_percentage = min(percentages) if percentages else 0

    weak_topic_counts: dict[str, int] = {}
    topic_score_map: dict[str, dict[str, Any]] = {}

    for test in submitted_tests_list:
        weak_topics = test.get("weak_topics", [])

        for topic in weak_topics:
            topic_name = safe_topic(topic)

            weak_topic_counts[topic_name] = (
                weak_topic_counts.get(topic_name, 0) + 1
            )

            if topic_name not in topic_score_map:
                topic_score_map[topic_name] = {
                    "topic": topic_name,
                    "total_score": 0,
                    "attempts": 0,
                    "weak_count": 0,
                }

            topic_score_map[topic_name]["weak_count"] += 1

        for question in test.get("questions", []):
            topic = safe_topic(question.get("topic_tag"))
            score = question.get("ai_score")

            if score is None:
                continue

            normalized_score = normalize_score(score)

            if topic not in topic_score_map:
                topic_score_map[topic] = {
                    "topic": topic,
                    "total_score": 0,
                    "attempts": 0,
                    "weak_count": 0,
                }

            topic_score_map[topic]["total_score"] += normalized_score
            topic_score_map[topic]["attempts"] += 1

    weak_topics = [
        {
            "topic": topic,
            "count": count,
        }
        for topic, count in weak_topic_counts.items()
    ]

    weak_topics.sort(key=lambda item: item["count"], reverse=True)

    weakest_topic = weak_topics[0]["topic"] if weak_topics else "No weak topic yet"

    topic_performance = []

    for topic_data in topic_score_map.values():
        attempts = int(topic_data.get("attempts", 0) or 0)
        total_score = int(topic_data.get("total_score", 0) or 0)

        average_score = round(total_score / attempts, 2) if attempts else 0
        average_percentage_score = round(average_score * 10)

        topic_performance.append(
            {
                "topic": topic_data["topic"],
                "attempts": attempts,
                "average_score": average_score,
                "average_percentage": average_percentage_score,
                "weak_count": int(topic_data.get("weak_count", 0) or 0),
            }
        )

    topic_performance.sort(
        key=lambda item: item["average_score"],
        reverse=True,
    )

    recent_submitted_tests = sorted(
        submitted_tests_list,
        key=lambda test: str(test.get("submitted_at", "")),
        reverse=True,
    )[:10]

    recent_tests = []

    for test in recent_submitted_tests:
        questions = test.get("questions", [])
        max_score = len(questions) * 10
        total_score = int(test.get("total_score", 0) or 0)
        percentage = calculate_test_percentage(test)

        recent_tests.append(
            {
                "id": str(test.get("_id")),
                "title": test.get("title", "Practice Test"),
                "status": test.get("status", "submitted"),
                "total_score": total_score,
                "max_score": max_score,
                "percentage": percentage,
                "questions_count": len(questions),
                "submitted_at": test.get("submitted_at", ""),
                "created_at": test.get("created_at", ""),
            }
        )

    score_trend = list(reversed(recent_tests))

    status_distribution = [
        {
            "name": "Submitted",
            "value": submitted_tests,
        },
        {
            "name": "In Progress",
            "value": in_progress_tests,
        },
    ]

    return {
        "success": True,
        "message": "Practice test analytics fetched successfully",
        "summary": {
            "total_tests": total_tests,
            "submitted_tests": submitted_tests,
            "in_progress_tests": in_progress_tests,
            "average_percentage": average_percentage,
            "best_percentage": best_percentage,
            "lowest_percentage": lowest_percentage,
            "weakest_topic": weakest_topic,
        },
        "status_distribution": status_distribution,
        "weak_topics": weak_topics,
        "topic_performance": topic_performance,
        "recent_tests": recent_tests,
        "score_trend": score_trend,
        "topic_summary_table": topic_performance,
    }


@router.get("/api/practice-tests/{test_id}")
async def get_practice_test_by_id(
    test_id: str,
    current_user: dict = Depends(get_current_user),
):
    user_id = get_user_id(current_user)

    if not ObjectId.is_valid(test_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid test_id",
        )

    test = await practice_tests_collection.find_one(
        {
            "_id": ObjectId(test_id),
            "user_id": user_id,
        }
    )

    if not test:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Practice test not found",
        )

    return {
        "success": True,
        "test": await serialize_practice_test(test),
    }


@router.patch("/api/practice-tests/{test_id}/save-answer")
async def save_practice_test_answer(
    test_id: str,
    answer_update: PracticeAnswerUpdate,
    current_user: dict = Depends(get_current_user),
):
    user_id = get_user_id(current_user)

    if not ObjectId.is_valid(test_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid test_id",
        )

    test = await practice_tests_collection.find_one(
        {
            "_id": ObjectId(test_id),
            "user_id": user_id,
        }
    )

    if not test:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Practice test not found",
        )

    if test.get("status") == "submitted":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This practice test is already submitted.",
        )

    questions = test.get("questions", [])
    question_index = answer_update.question_index

    if question_index < 0 or question_index >= len(questions):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid question index",
        )

    current_time = now_iso()

    questions[question_index]["student_answer"] = answer_update.student_answer
    questions[question_index]["answered_at"] = current_time

    await practice_tests_collection.update_one(
        {
            "_id": ObjectId(test_id),
            "user_id": user_id,
        },
        {
            "$set": {
                "questions": questions,
                "updated_at": current_time,
            }
        },
    )

    updated_test = await practice_tests_collection.find_one(
        {
            "_id": ObjectId(test_id),
            "user_id": user_id,
        }
    )

    return {
        "success": True,
        "message": "Practice answer saved successfully",
        "question_index": question_index,
        "test": await serialize_practice_test(updated_test),
    }


@router.post("/api/practice-tests/{test_id}/submit")
async def submit_practice_test(
    test_id: str,
    current_user: dict = Depends(get_current_user),
):
    user_id = get_user_id(current_user)

    if not ObjectId.is_valid(test_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid test_id",
        )

    test = await practice_tests_collection.find_one(
        {
            "_id": ObjectId(test_id),
            "user_id": user_id,
        }
    )

    if not test:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Practice test not found",
        )

    questions = test.get("questions", [])

    if not questions:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No questions found in this practice test.",
        )

    assignment_id = test.get("assignment_id", "")
    pdf_context = ""

    if ObjectId.is_valid(assignment_id):
        assignment = await assignments_collection.find_one(
            {
                "_id": ObjectId(assignment_id),
                "user_id": user_id,
            }
        )

        if assignment:
            pdf_context = assignment.get("pdf_text", "")

    current_time = now_iso()
    total_score = 0
    topic_scores: dict[str, list[int]] = {}

    for index, question in enumerate(questions):
        student_answer = str(question.get("student_answer", "")).strip()
        topic_tag = safe_topic(question.get("topic_tag"))
        difficulty = safe_difficulty(question.get("difficulty"))

        if not student_answer:
            questions[index]["ai_score"] = 0
            questions[index]["ai_feedback"] = "No answer written for this question."
            questions[index]["strengths"] = []
            questions[index]["missing_points"] = ["Answer was not attempted."]
            questions[index]["model_answer"] = ""
            questions[index]["evaluated_at"] = current_time

            topic_scores.setdefault(topic_tag, []).append(0)
            continue

        evaluation = await evaluate_practice_answer_with_groq(
            question_text=str(question.get("question", "")),
            student_answer=student_answer,
            pdf_context=pdf_context,
            topic_tag=topic_tag,
            difficulty=difficulty,
        )

        score = int(evaluation.get("ai_score", 0) or 0)

        questions[index]["ai_score"] = score
        questions[index]["ai_feedback"] = evaluation.get("ai_feedback", "")
        questions[index]["strengths"] = evaluation.get("strengths", [])
        questions[index]["missing_points"] = evaluation.get("missing_points", [])
        questions[index]["model_answer"] = evaluation.get("model_answer", "")
        questions[index]["evaluated_at"] = current_time

        total_score += score
        topic_scores.setdefault(topic_tag, []).append(score)

    weak_topics = []

    for topic, scores in topic_scores.items():
        if not scores:
            continue

        average = sum(scores) / len(scores)

        if average < 6:
            weak_topics.append(topic)

    max_score = len(questions) * 10
    percentage = round((total_score / max_score) * 100) if max_score else 0

    await practice_tests_collection.update_one(
        {
            "_id": ObjectId(test_id),
            "user_id": user_id,
        },
        {
            "$set": {
                "questions": questions,
                "total_score": total_score,
                "weak_topics": weak_topics,
                "status": "submitted",
                "submitted_at": current_time,
                "updated_at": current_time,
            }
        },
    )

    updated_test = await practice_tests_collection.find_one(
        {
            "_id": ObjectId(test_id),
            "user_id": user_id,
        }
    )

    return {
        "success": True,
        "message": "Practice test submitted successfully",
        "total_score": total_score,
        "max_score": max_score,
        "percentage": percentage,
        "weak_topics": weak_topics,
        "test": await serialize_practice_test(updated_test),
    }