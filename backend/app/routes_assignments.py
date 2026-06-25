import io
import os
import re
import json
from datetime import datetime, timezone
from typing import Any, Optional
from xml.sax.saxutils import escape

from bson import ObjectId
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import StreamingResponse
from pdfminer.high_level import extract_text
from pydantic import BaseModel

from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer

try:
    from groq import AsyncGroq
except Exception:
    AsyncGroq = None

from app.auth import get_current_user
from app.database import database
from app.models import AssignmentCreate


router = APIRouter(
    prefix="/api/assignments",
    tags=["Assignments"]
)

assignments_collection = database["assignments"]
subjects_collection = database["subjects"]


class AssignmentUpdate(BaseModel):
    title: Optional[str] = None
    subject_id: Optional[str] = None
    description: Optional[str] = None
    details: Optional[str] = None
    due_date: Optional[str] = None
    priority: Optional[str] = None
    status: Optional[str] = None


class QuestionAnswerUpdate(BaseModel):
    question_index: int
    student_answer: str


class QuestionEvaluationRequest(BaseModel):
    question_index: int
    student_answer: str


class QuestionImportantUpdate(BaseModel):
    question_index: int
    is_important: bool


class QuestionDifficultyUpdate(BaseModel):
    question_index: int
    difficulty: str


class QuestionAIAnswerRequest(BaseModel):
    question_index: int


class QuestionAutoTagRequest(BaseModel):
    limit: Optional[int] = 12


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def safe_pdf_text(value: Any) -> str:
    text = str(value or "")
    text = escape(text)
    text = text.replace("\n", "<br/>")
    return text


def get_user_id(current_user: dict) -> str:
    return str(
        current_user.get("_id")
        or current_user.get("id")
        or current_user.get("email")
    )


def get_model_value(model: Any, field_name: str, default: Any = "") -> Any:
    return getattr(model, field_name, default)


def normalize_difficulty(value: Any) -> str:
    difficulty = str(value or "").strip().lower()

    allowed_difficulties = {"easy", "medium", "hard"}

    if difficulty not in allowed_difficulties:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid difficulty. Allowed values are: easy, medium, hard."
        )

    return difficulty


def safe_normalize_difficulty(value: Any) -> str:
    difficulty = str(value or "").strip().lower()

    if difficulty in {"easy", "medium", "hard"}:
        return difficulty

    return "medium"


def normalize_topic_tag(value: Any) -> str:
    topic = str(value or "").strip()

    if not topic:
        return ""

    topic = re.sub(r"[^a-zA-Z0-9+.#/&()\- ]", "", topic)
    topic = re.sub(r"\s+", " ", topic).strip()

    if not topic:
        return ""

    topic_map = {
        "k nearest neighbor": "KNN",
        "k-nearest neighbor": "KNN",
        "knn": "KNN",
        "support vector machine": "SVM",
        "svm": "SVM",
        "convolutional neural network": "CNN",
        "cnn": "CNN",
        "genetic algorithm": "Genetic Algorithm",
        "ga": "Genetic Algorithm",
        "decision tree": "Decision Tree",
        "naive bayes": "Naive Bayes",
        "naïve bayes": "Naive Bayes",
        "reinforcement learning": "Reinforcement Learning",
        "q learning": "Q-Learning",
        "q-learning": "Q-Learning",
        "backpropagation": "Backpropagation",
        "perceptron": "Perceptron",
        "regression": "Regression",
        "entropy": "Entropy",
        "information gain": "Information Gain",
        "em algorithm": "EM Algorithm",
        "expectation maximization": "EM Algorithm",
        "map hypothesis": "MAP Hypothesis",
        "maximum a posteriori": "MAP Hypothesis",
        "svms": "SVM",
        "case based learning": "Case Based Learning",
        "case-based learning": "Case Based Learning",
        "instance based learning": "Instance Based Learning",
        "instance-based learning": "Instance Based Learning",
        "pac learning": "PAC Learning",
        "radial basis function": "RBF",
        "rbf": "RBF",
        "kohonen": "Kohonen SOM",
        "self organizing maps": "Kohonen SOM",
        "self-organizing maps": "Kohonen SOM",
    }

    lowered = topic.lower()

    for key, mapped_topic in topic_map.items():
        if lowered == key:
            return mapped_topic

    return topic[:40]


def to_bool(value: Any) -> bool:
    if isinstance(value, bool):
        return value

    if isinstance(value, (int, float)):
        return value != 0

    value_text = str(value or "").strip().lower()

    return value_text in {"true", "yes", "1", "important", "high"}


async def get_subject_name(subject_id: str, user_id: str) -> str:
    if not subject_id or not ObjectId.is_valid(subject_id):
        return "Unknown Subject"

    subject = await subjects_collection.find_one({
        "_id": ObjectId(subject_id),
        "user_id": user_id
    })

    if not subject:
        return "Unknown Subject"

    return subject.get("name", "Unknown Subject")


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


def normalize_score(value: Any) -> Optional[int]:
    if value is None:
        return None

    match = re.search(r"\d+(\.\d+)?", str(value))

    if not match:
        return None

    score = round(float(match.group(0)))
    return max(0, min(10, score))


def extract_json_from_ai_response(text: str) -> dict:
    if not text:
        raise ValueError("Empty AI response")

    cleaned = text.strip()
    cleaned = cleaned.replace("```json", "").replace("```", "").strip()

    match = re.search(r"\{.*\}", cleaned, flags=re.DOTALL)

    if not match:
        raise ValueError("No JSON object found in AI response")

    return json.loads(match.group(0))


def extract_tags_from_ai_response(text: str) -> list[dict]:
    if not text:
        raise ValueError("Empty AI response")

    cleaned = text.strip()
    cleaned = cleaned.replace("```json", "").replace("```", "").strip()

    try:
        parsed = json.loads(cleaned)
    except Exception:
        object_match = re.search(r"\{.*\}", cleaned, flags=re.DOTALL)
        array_match = re.search(r"\[.*\]", cleaned, flags=re.DOTALL)

        if object_match:
            parsed = json.loads(object_match.group(0))
        elif array_match:
            parsed = json.loads(array_match.group(0))
        else:
            raise ValueError("No JSON found in AI response")

    if isinstance(parsed, dict):
        tags = parsed.get("tags") or parsed.get("questions") or parsed.get("data") or []
    elif isinstance(parsed, list):
        tags = parsed
    else:
        tags = []

    if not isinstance(tags, list):
        raise ValueError("AI tags response is not a list")

    cleaned_tags = []

    for item in tags:
        if not isinstance(item, dict):
            continue

        try:
            question_index = int(item.get("question_index"))
        except Exception:
            continue

        cleaned_tags.append({
            "question_index": question_index,
            "difficulty": safe_normalize_difficulty(item.get("difficulty")),
            "is_important": to_bool(item.get("is_important")),
            "topic_tag": normalize_topic_tag(item.get("topic_tag") or item.get("topic") or item.get("tag"))
        })

    return cleaned_tags


def basic_auto_tag_question(question_text: str) -> dict:
    text = str(question_text or "").lower()

    topic_rules = [
        ("naive bayes", "Naive Bayes"),
        ("naïve bayes", "Naive Bayes"),
        ("bayes", "Bayesian Learning"),
        ("knn", "KNN"),
        ("nearest neighbor", "KNN"),
        ("support vector", "SVM"),
        ("svm", "SVM"),
        ("convolutional", "CNN"),
        ("cnn", "CNN"),
        ("decision tree", "Decision Tree"),
        ("entropy", "Entropy"),
        ("information gain", "Information Gain"),
        ("gini", "Decision Tree"),
        ("genetic", "Genetic Algorithm"),
        ("reinforcement", "Reinforcement Learning"),
        ("q-learning", "Q-Learning"),
        ("q learning", "Q-Learning"),
        ("perceptron", "Perceptron"),
        ("backpropagation", "Backpropagation"),
        ("regression", "Regression"),
        ("em algorithm", "EM Algorithm"),
        ("map hypothesis", "MAP Hypothesis"),
        ("maximum likelihood", "MLE"),
        ("least squared", "Least Squares"),
        ("instance based", "Instance Based Learning"),
        ("case based", "Case Based Learning"),
        ("pac", "PAC Learning"),
        ("radial basis", "RBF"),
        ("kohonen", "Kohonen SOM"),
        ("self organizing", "Kohonen SOM"),
        ("find-s", "Find-S Algorithm"),
        ("concept learning", "Concept Learning"),
    ]

    topic_tag = "Machine Learning"

    for keyword, topic in topic_rules:
        if keyword in text:
            topic_tag = topic
            break

    hard_keywords = [
        "derive",
        "design",
        "classify",
        "given",
        "draw",
        "algorithm with example",
        "in detail",
        "detailed",
        "compare and contrast",
        "discuss various",
        "architecture",
    ]

    easy_keywords = [
        "define",
        "what is",
        "what are",
        "differentiate",
        "short notes",
    ]

    if any(keyword in text for keyword in hard_keywords) or len(text) > 180:
        difficulty = "hard"
    elif any(keyword in text for keyword in easy_keywords) and len(text) < 100:
        difficulty = "easy"
    else:
        difficulty = "medium"

    important_topics = {
        "KNN",
        "SVM",
        "CNN",
        "Decision Tree",
        "Naive Bayes",
        "Genetic Algorithm",
        "Reinforcement Learning",
        "Backpropagation",
        "Perceptron",
        "Regression",
    }

    is_important = difficulty == "hard" or topic_tag in important_topics

    return {
        "difficulty": difficulty,
        "is_important": is_important,
        "topic_tag": topic_tag
    }


async def evaluate_answer_with_groq(
    question_text: str,
    student_answer: str,
    pdf_context: str = ""
) -> dict:
    if AsyncGroq is None:
        raise HTTPException(
            status_code=500,
            detail="Groq package is not installed. Run: pip install groq"
        )

    api_key = os.getenv("GROQ_API_KEY", "").strip()

    if not api_key:
        raise HTTPException(
            status_code=500,
            detail="GROQ_API_KEY is missing in backend .env file"
        )

    model = os.getenv("GROQ_MODEL", "llama-3.1-8b-instant").strip()
    client = AsyncGroq(api_key=api_key)

    system_prompt = """
You are CampusAgent AI, an academic answer evaluator for B.Tech students.

Return ONLY valid JSON in this exact format:

{
  "ai_score": 7,
  "ai_feedback": "Short overall feedback.",
  "strengths": ["point 1", "point 2"],
  "missing_points": ["point 1", "point 2"],
  "improved_answer": "A better version of the answer."
}

Rules:
- Score must be from 0 to 10.
- Be helpful and student-friendly.
- Do not return markdown.
- Do not return extra text outside JSON.
"""

    user_prompt = f"""
Question:
{question_text}

Student Answer:
{student_answer}

PDF Context:
{pdf_context[:3500]}
"""

    try:
        completion = await client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            temperature=0.3,
            max_tokens=900
        )

        raw_answer = completion.choices[0].message.content or ""

        try:
            parsed = extract_json_from_ai_response(raw_answer)

            return {
                "ai_score": normalize_score(parsed.get("ai_score")),
                "ai_feedback": str(parsed.get("ai_feedback", "")).strip(),
                "strengths": normalize_text_list(parsed.get("strengths")),
                "missing_points": normalize_text_list(parsed.get("missing_points")),
                "improved_answer": str(parsed.get("improved_answer", "")).strip()
            }

        except Exception:
            return {
                "ai_score": None,
                "ai_feedback": raw_answer.strip(),
                "strengths": [],
                "missing_points": [],
                "improved_answer": ""
            }

    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"Groq AI evaluation error: {str(error)}"
        )


async def generate_ai_answer_with_groq(
    question_text: str,
    pdf_context: str = "",
    difficulty: str = "medium"
) -> str:
    if AsyncGroq is None:
        raise HTTPException(
            status_code=500,
            detail="Groq package is not installed. Run: pip install groq"
        )

    api_key = os.getenv("GROQ_API_KEY", "").strip()

    if not api_key:
        raise HTTPException(
            status_code=500,
            detail="GROQ_API_KEY is missing in backend .env file"
        )

    model = os.getenv("GROQ_MODEL", "llama-3.1-8b-instant").strip()
    client = AsyncGroq(api_key=api_key)

    system_prompt = """
You are CampusAgent AI, an academic answer generator for B.Tech students.

Generate a clear, exam-ready model answer for the given question.

Rules:
- Answer in simple student-friendly language.
- Make it useful for semester exams.
- Use headings or bullet points when helpful.
- Do not mention that you are an AI.
- Do not return JSON.
- Do not add unnecessary introduction.
"""

    user_prompt = f"""
Question:
{question_text}

Difficulty Level:
{difficulty}

PDF Context:
{pdf_context[:3500]}

Generate the best possible academic answer.
"""

    try:
        completion = await client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            temperature=0.4,
            max_tokens=900
        )

        answer = completion.choices[0].message.content or ""
        cleaned_answer = answer.strip()

        if not cleaned_answer:
            raise HTTPException(
                status_code=500,
                detail="AI generated an empty answer"
            )

        return cleaned_answer

    except HTTPException:
        raise

    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"Groq AI answer generation error: {str(error)}"
        )


async def auto_tag_questions_with_groq(
    questions_for_tagging: list[dict],
    pdf_context: str = ""
) -> list[dict]:
    if AsyncGroq is None:
        raise HTTPException(
            status_code=500,
            detail="Groq package is not installed. Run: pip install groq"
        )

    api_key = os.getenv("GROQ_API_KEY", "").strip()

    if not api_key:
        raise HTTPException(
            status_code=500,
            detail="GROQ_API_KEY is missing in backend .env file"
        )

    model = os.getenv("GROQ_MODEL", "llama-3.1-8b-instant").strip()
    client = AsyncGroq(api_key=api_key)

    compact_questions = []

    for item in questions_for_tagging:
        compact_questions.append({
            "question_index": item["question_index"],
            "question": str(item["question"])[:220]
        })

    system_prompt = """
You tag B.Tech Machine Learning exam questions.

Return ONLY valid JSON. No markdown.

Format:
{
  "tags": [
    {
      "question_index": 0,
      "difficulty": "easy",
      "is_important": true,
      "topic_tag": "KNN"
    }
  ]
}

Rules:
- difficulty must be exactly: easy, medium, or hard.
- is_important must be true or false.
- topic_tag must be short, like KNN, CNN, SVM, Decision Tree, Genetic Algorithm, Naive Bayes, Regression, Reinforcement Learning, Backpropagation, Perceptron, Entropy, Information Gain, PAC Learning.
"""

    user_prompt = f"""
Questions:
{json.dumps(compact_questions, ensure_ascii=False)}
"""

    try:
        completion = await client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            temperature=0.1,
            max_tokens=1200
        )

        raw_answer = completion.choices[0].message.content or ""
        return extract_tags_from_ai_response(raw_answer)

    except HTTPException:
        raise

    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"Groq AI auto-tagging error: {str(error)}"
        )


def extract_questions_from_pdf_text(pdf_text: str) -> list:
    if not pdf_text:
        return []

    text = " ".join(pdf_text.split())

    pattern = r"(?:^|\s)(?:Q\.?\s*)?(\d{1,3})[\.\)]\s+(.*?)(?=\s(?:Q\.?\s*)?\d{1,3}[\.\)]\s+|$)"

    matches = re.findall(pattern, text, flags=re.IGNORECASE)
    questions = []

    for number, question_text in matches:
        question = question_text.strip()

        if len(question) < 6:
            continue

        questions.append({
            "question_number": int(number),
            "question": question,
            "student_answer": "",
            "ai_explanation": "",
            "is_important": False,
            "difficulty": "medium",
            "topic_tag": "",
            "auto_tagged_at": "",

            "ai_generated_answer": "",
            "ai_answer_generated_at": "",

            "ai_score": None,
            "ai_feedback": "",
            "strengths": [],
            "missing_points": [],
            "improved_answer": "",
            "evaluated_at": "",

            "score": None,
            "answered_at": ""
        })

    return questions


async def serialize_assignment(assignment: dict) -> dict:
    details = assignment.get("details") or assignment.get("description") or ""

    pdf_text = assignment.get("pdf_text") or ""
    user_id = assignment.get("user_id", "")
    subject_id = str(assignment.get("subject_id", ""))

    subject_name = await get_subject_name(subject_id, user_id)
    questions = assignment.get("questions", [])

    answered_count = 0
    evaluated_count = 0
    important_count = 0
    ai_answer_count = 0
    auto_tagged_count = 0

    difficulty_counts = {
        "easy": 0,
        "medium": 0,
        "hard": 0
    }

    topic_counts = {}

    for question in questions:
        if str(question.get("student_answer", "")).strip():
            answered_count += 1

        if bool(question.get("is_important", False)):
            important_count += 1

        if str(question.get("ai_generated_answer", "")).strip():
            ai_answer_count += 1

        topic_tag = normalize_topic_tag(question.get("topic_tag", ""))

        if topic_tag:
            auto_tagged_count += 1
            topic_counts[topic_tag] = topic_counts.get(topic_tag, 0) + 1

        difficulty = str(question.get("difficulty", "medium")).strip().lower()

        if difficulty in difficulty_counts:
            difficulty_counts[difficulty] += 1
        else:
            difficulty_counts["medium"] += 1

        has_evaluation = (
            question.get("ai_score") is not None
            or question.get("score") is not None
            or bool(str(question.get("ai_feedback", "")).strip())
            or bool(str(question.get("evaluated_at", "")).strip())
        )

        if has_evaluation:
            evaluated_count += 1

    questions_count = len(questions)

    completion_percentage = (
        round((answered_count / questions_count) * 100)
        if questions_count > 0
        else 0
    )

    return {
        "id": str(assignment["_id"]),
        "_id": str(assignment["_id"]),
        "title": assignment.get("title", "Untitled Assignment"),
        "subject_id": subject_id,
        "subject": subject_name,
        "subject_name": subject_name,
        "description": assignment.get("description", ""),
        "details": details,
        "due_date": assignment.get("due_date", ""),
        "priority": assignment.get("priority", "medium"),
        "status": assignment.get("status", "pending"),
        "user_id": user_id,
        "created_at": assignment.get("created_at", ""),
        "updated_at": assignment.get("updated_at", ""),

        "pdf_filename": assignment.get("pdf_filename", ""),
        "has_pdf": bool(pdf_text or assignment.get("pdf_filename")),
        "pdf_text_preview": pdf_text[:500],
        "pdf_text_length": len(pdf_text),
        "pdf_uploaded_at": assignment.get("pdf_uploaded_at", ""),

        "questions": questions,
        "questions_count": questions_count,
        "answered_count": answered_count,
        "evaluated_count": evaluated_count,
        "important_count": important_count,
        "ai_answer_count": ai_answer_count,
        "auto_tagged_count": auto_tagged_count,
        "difficulty_counts": difficulty_counts,
        "topic_counts": topic_counts,
        "completion_percentage": completion_percentage,
        "all_questions_answered": questions_count > 0 and answered_count == questions_count,

        "questions_extracted_at": assignment.get("questions_extracted_at", ""),
        "answers_updated_at": assignment.get("answers_updated_at", ""),
        "evaluations_updated_at": assignment.get("evaluations_updated_at", ""),
        "difficulty_updated_at": assignment.get("difficulty_updated_at", ""),
        "ai_answers_updated_at": assignment.get("ai_answers_updated_at", ""),
        "auto_tagged_at": assignment.get("auto_tagged_at", "")
    }


@router.post("")
async def create_assignment(
    assignment: AssignmentCreate,
    current_user: dict = Depends(get_current_user)
):
    user_id = get_user_id(current_user)

    if not ObjectId.is_valid(assignment.subject_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid subject_id"
        )

    subject = await subjects_collection.find_one({
        "_id": ObjectId(assignment.subject_id),
        "user_id": user_id
    })

    if not subject:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Subject not found for this user"
        )

    details = (
        get_model_value(assignment, "details", "")
        or get_model_value(assignment, "description", "")
        or ""
    )

    current_time = now_iso()

    assignment_data = {
        "user_id": user_id,
        "title": assignment.title,
        "subject_id": assignment.subject_id,
        "description": get_model_value(assignment, "description", "") or "",
        "details": details,
        "due_date": assignment.due_date,
        "priority": get_model_value(assignment, "priority", "medium") or "medium",
        "status": get_model_value(assignment, "status", "pending") or "pending",

        "pdf_filename": "",
        "pdf_text": "",
        "pdf_uploaded_at": "",

        "questions": [],
        "questions_extracted_at": "",
        "answers_updated_at": "",
        "evaluations_updated_at": "",
        "difficulty_updated_at": "",
        "ai_answers_updated_at": "",
        "auto_tagged_at": "",

        "created_at": current_time,
        "updated_at": current_time
    }

    result = await assignments_collection.insert_one(assignment_data)

    new_assignment = await assignments_collection.find_one({
        "_id": result.inserted_id
    })

    return {
        "success": True,
        "message": "Assignment created successfully",
        "assignment": await serialize_assignment(new_assignment)
    }


@router.get("")
async def get_assignments(
    current_user: dict = Depends(get_current_user)
):
    user_id = get_user_id(current_user)

    assignments_cursor = assignments_collection.find({
        "user_id": user_id
    }).sort("created_at", -1)

    assignments = []

    async for assignment in assignments_cursor:
        assignments.append(await serialize_assignment(assignment))

    return {
        "success": True,
        "message": "Assignments fetched successfully",
        "count": len(assignments),
        "assignments": assignments
    }


@router.get("/{assignment_id}")
async def get_assignment_by_id(
    assignment_id: str,
    current_user: dict = Depends(get_current_user)
):
    user_id = get_user_id(current_user)

    if not ObjectId.is_valid(assignment_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid assignment_id"
        )

    assignment = await assignments_collection.find_one({
        "_id": ObjectId(assignment_id),
        "user_id": user_id
    })

    if not assignment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assignment not found"
        )

    return {
        "success": True,
        "assignment": await serialize_assignment(assignment)
    }


@router.patch("/{assignment_id}")
async def update_assignment(
    assignment_id: str,
    assignment_update: AssignmentUpdate,
    current_user: dict = Depends(get_current_user)
):
    user_id = get_user_id(current_user)

    if not ObjectId.is_valid(assignment_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid assignment_id"
        )

    existing_assignment = await assignments_collection.find_one({
        "_id": ObjectId(assignment_id),
        "user_id": user_id
    })

    if not existing_assignment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assignment not found"
        )

    update_data = {}

    if assignment_update.title is not None:
        update_data["title"] = assignment_update.title

    if assignment_update.subject_id is not None:
        if not ObjectId.is_valid(assignment_update.subject_id):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid subject_id"
            )

        subject = await subjects_collection.find_one({
            "_id": ObjectId(assignment_update.subject_id),
            "user_id": user_id
        })

        if not subject:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Subject not found for this user"
            )

        update_data["subject_id"] = assignment_update.subject_id

    if assignment_update.description is not None:
        update_data["description"] = assignment_update.description

    if assignment_update.details is not None:
        update_data["details"] = assignment_update.details

    if assignment_update.due_date is not None:
        update_data["due_date"] = assignment_update.due_date

    if assignment_update.priority is not None:
        update_data["priority"] = assignment_update.priority

    if assignment_update.status is not None:
        update_data["status"] = assignment_update.status

    if not update_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No fields provided for update"
        )

    update_data["updated_at"] = now_iso()

    await assignments_collection.update_one(
        {"_id": ObjectId(assignment_id), "user_id": user_id},
        {"$set": update_data}
    )

    updated_assignment = await assignments_collection.find_one({
        "_id": ObjectId(assignment_id),
        "user_id": user_id
    })

    return {
        "success": True,
        "message": "Assignment updated successfully",
        "assignment": await serialize_assignment(updated_assignment)
    }


@router.post("/{assignment_id}/upload-pdf")
async def upload_assignment_pdf(
    assignment_id: str,
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    user_id = get_user_id(current_user)

    if not ObjectId.is_valid(assignment_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid assignment_id"
        )

    if not file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File name is missing"
        )

    is_pdf_file = file.filename.lower().endswith(".pdf")
    is_pdf_content = file.content_type == "application/pdf"

    if not is_pdf_file and not is_pdf_content:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only PDF files are allowed"
        )

    existing_assignment = await assignments_collection.find_one({
        "_id": ObjectId(assignment_id),
        "user_id": user_id
    })

    if not existing_assignment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assignment not found"
        )

    file_bytes = await file.read()

    if len(file_bytes) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded PDF is empty"
        )

    if len(file_bytes) > 5 * 1024 * 1024:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="PDF too large. Please upload a file smaller than 5 MB."
        )

    try:
        extracted_text = extract_text(io.BytesIO(file_bytes))
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Could not parse this PDF. Please try another text-based PDF."
        )

    cleaned_text = " ".join(extracted_text.split())

    if not cleaned_text:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No readable text found in this PDF. Scanned/image PDFs are not supported yet."
        )

    cleaned_text = cleaned_text[:12000]
    current_time = now_iso()

    await assignments_collection.update_one(
        {"_id": ObjectId(assignment_id), "user_id": user_id},
        {
            "$set": {
                "pdf_filename": file.filename,
                "pdf_text": cleaned_text,
                "pdf_uploaded_at": current_time,
                "questions": [],
                "questions_extracted_at": "",
                "answers_updated_at": "",
                "evaluations_updated_at": "",
                "difficulty_updated_at": "",
                "ai_answers_updated_at": "",
                "auto_tagged_at": "",
                "updated_at": current_time
            }
        }
    )

    updated_assignment = await assignments_collection.find_one({
        "_id": ObjectId(assignment_id),
        "user_id": user_id
    })

    return {
        "success": True,
        "message": "PDF uploaded and parsed successfully",
        "assignment_id": assignment_id,
        "assignment": await serialize_assignment(updated_assignment),
        "pdf_filename": file.filename,
        "characters_extracted": len(cleaned_text),
        "preview": cleaned_text[:500]
    }


@router.post("/{assignment_id}/extract-questions")
async def extract_assignment_questions(
    assignment_id: str,
    current_user: dict = Depends(get_current_user)
):
    user_id = get_user_id(current_user)

    if not ObjectId.is_valid(assignment_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid assignment_id"
        )

    assignment = await assignments_collection.find_one({
        "_id": ObjectId(assignment_id),
        "user_id": user_id
    })

    if not assignment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assignment not found"
        )

    pdf_text = assignment.get("pdf_text", "")

    if not pdf_text:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No PDF text found. Please upload a PDF first."
        )

    extracted_questions = extract_questions_from_pdf_text(pdf_text)

    if not extracted_questions:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No questions could be extracted from this PDF."
        )

    current_time = now_iso()

    await assignments_collection.update_one(
        {"_id": ObjectId(assignment_id), "user_id": user_id},
        {
            "$set": {
                "questions": extracted_questions,
                "questions_extracted_at": current_time,
                "answers_updated_at": "",
                "evaluations_updated_at": "",
                "difficulty_updated_at": "",
                "ai_answers_updated_at": "",
                "auto_tagged_at": "",
                "updated_at": current_time
            }
        }
    )

    updated_assignment = await assignments_collection.find_one({
        "_id": ObjectId(assignment_id),
        "user_id": user_id
    })

    return {
        "success": True,
        "message": "Questions extracted successfully",
        "count": len(extracted_questions),
        "questions": extracted_questions,
        "assignment": await serialize_assignment(updated_assignment)
    }


@router.patch("/{assignment_id}/questions/save-answer")
async def save_question_answer(
    assignment_id: str,
    answer_update: QuestionAnswerUpdate,
    current_user: dict = Depends(get_current_user)
):
    user_id = get_user_id(current_user)

    if not ObjectId.is_valid(assignment_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid assignment_id"
        )

    assignment = await assignments_collection.find_one({
        "_id": ObjectId(assignment_id),
        "user_id": user_id
    })

    if not assignment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assignment not found"
        )

    questions = assignment.get("questions", [])

    if not questions:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No extracted questions found. Please extract questions first."
        )

    question_index = answer_update.question_index

    if question_index < 0 or question_index >= len(questions):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid question index"
        )

    current_time = now_iso()

    questions[question_index]["student_answer"] = answer_update.student_answer
    questions[question_index]["answered_at"] = current_time

    if "difficulty" not in questions[question_index]:
        questions[question_index]["difficulty"] = "medium"

    if "is_important" not in questions[question_index]:
        questions[question_index]["is_important"] = False

    if "ai_generated_answer" not in questions[question_index]:
        questions[question_index]["ai_generated_answer"] = ""

    if "ai_answer_generated_at" not in questions[question_index]:
        questions[question_index]["ai_answer_generated_at"] = ""

    if "topic_tag" not in questions[question_index]:
        questions[question_index]["topic_tag"] = ""

    if "auto_tagged_at" not in questions[question_index]:
        questions[question_index]["auto_tagged_at"] = ""

    await assignments_collection.update_one(
        {"_id": ObjectId(assignment_id), "user_id": user_id},
        {
            "$set": {
                "questions": questions,
                "answers_updated_at": current_time,
                "updated_at": current_time
            }
        }
    )

    updated_assignment = await assignments_collection.find_one({
        "_id": ObjectId(assignment_id),
        "user_id": user_id
    })

    return {
        "success": True,
        "message": "Answer saved successfully",
        "question_index": question_index,
        "assignment": await serialize_assignment(updated_assignment)
    }


@router.patch("/{assignment_id}/questions/mark-important")
async def mark_question_important(
    assignment_id: str,
    important_update: QuestionImportantUpdate,
    current_user: dict = Depends(get_current_user)
):
    user_id = get_user_id(current_user)

    if not ObjectId.is_valid(assignment_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid assignment_id"
        )

    assignment = await assignments_collection.find_one({
        "_id": ObjectId(assignment_id),
        "user_id": user_id
    })

    if not assignment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assignment not found"
        )

    questions = assignment.get("questions", [])

    if not questions:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No extracted questions found. Please extract questions first."
        )

    question_index = important_update.question_index

    if question_index < 0 or question_index >= len(questions):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid question index"
        )

    current_time = now_iso()

    questions[question_index]["is_important"] = important_update.is_important

    if "difficulty" not in questions[question_index]:
        questions[question_index]["difficulty"] = "medium"

    if "ai_generated_answer" not in questions[question_index]:
        questions[question_index]["ai_generated_answer"] = ""

    if "ai_answer_generated_at" not in questions[question_index]:
        questions[question_index]["ai_answer_generated_at"] = ""

    if "topic_tag" not in questions[question_index]:
        questions[question_index]["topic_tag"] = ""

    if "auto_tagged_at" not in questions[question_index]:
        questions[question_index]["auto_tagged_at"] = ""

    await assignments_collection.update_one(
        {
            "_id": ObjectId(assignment_id),
            "user_id": user_id
        },
        {
            "$set": {
                "questions": questions,
                "updated_at": current_time
            }
        }
    )

    updated_assignment = await assignments_collection.find_one({
        "_id": ObjectId(assignment_id),
        "user_id": user_id
    })

    return {
        "success": True,
        "message": (
            "Question marked as important"
            if important_update.is_important
            else "Question removed from important"
        ),
        "question_index": question_index,
        "is_important": important_update.is_important,
        "assignment": await serialize_assignment(updated_assignment)
    }


@router.patch("/{assignment_id}/questions/update-difficulty")
async def update_question_difficulty(
    assignment_id: str,
    difficulty_update: QuestionDifficultyUpdate,
    current_user: dict = Depends(get_current_user)
):
    user_id = get_user_id(current_user)

    if not ObjectId.is_valid(assignment_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid assignment_id"
        )

    assignment = await assignments_collection.find_one({
        "_id": ObjectId(assignment_id),
        "user_id": user_id
    })

    if not assignment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assignment not found"
        )

    questions = assignment.get("questions", [])

    if not questions:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No extracted questions found. Please extract questions first."
        )

    question_index = difficulty_update.question_index

    if question_index < 0 or question_index >= len(questions):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid question index"
        )

    difficulty = normalize_difficulty(difficulty_update.difficulty)
    current_time = now_iso()

    questions[question_index]["difficulty"] = difficulty

    if "is_important" not in questions[question_index]:
        questions[question_index]["is_important"] = False

    if "ai_generated_answer" not in questions[question_index]:
        questions[question_index]["ai_generated_answer"] = ""

    if "ai_answer_generated_at" not in questions[question_index]:
        questions[question_index]["ai_answer_generated_at"] = ""

    if "topic_tag" not in questions[question_index]:
        questions[question_index]["topic_tag"] = ""

    if "auto_tagged_at" not in questions[question_index]:
        questions[question_index]["auto_tagged_at"] = ""

    await assignments_collection.update_one(
        {
            "_id": ObjectId(assignment_id),
            "user_id": user_id
        },
        {
            "$set": {
                "questions": questions,
                "difficulty_updated_at": current_time,
                "updated_at": current_time
            }
        }
    )

    updated_assignment = await assignments_collection.find_one({
        "_id": ObjectId(assignment_id),
        "user_id": user_id
    })

    return {
        "success": True,
        "message": f"Question difficulty updated to {difficulty}",
        "question_index": question_index,
        "difficulty": difficulty,
        "assignment": await serialize_assignment(updated_assignment)
    }


@router.patch("/{assignment_id}/questions/auto-tag")
async def auto_tag_assignment_questions(
    assignment_id: str,
    auto_tag_request: QuestionAutoTagRequest,
    current_user: dict = Depends(get_current_user)
):
    user_id = get_user_id(current_user)

    if not ObjectId.is_valid(assignment_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid assignment_id"
        )

    assignment = await assignments_collection.find_one({
        "_id": ObjectId(assignment_id),
        "user_id": user_id
    })

    if not assignment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assignment not found"
        )

    questions = assignment.get("questions", [])

    if not questions:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No extracted questions found. Please extract questions first."
        )

    requested_limit = auto_tag_request.limit or 12
    requested_limit = max(1, min(int(requested_limit), len(questions), 12))

    questions_for_tagging = []

    # Tag untagged questions first, so every click moves progress forward.
    for index, question in enumerate(questions):
        if len(questions_for_tagging) >= requested_limit:
            break

        question_text = str(question.get("question", "")).strip()
        already_tagged = bool(str(question.get("topic_tag", "")).strip())

        if question_text and not already_tagged:
            questions_for_tagging.append({
                "question_index": index,
                "question": question_text
            })

    # If every question is already tagged, allow retagging the first batch.
    if not questions_for_tagging:
        for index, question in enumerate(questions[:requested_limit]):
            question_text = str(question.get("question", "")).strip()

            if question_text:
                questions_for_tagging.append({
                    "question_index": index,
                    "question": question_text
                })

    if not questions_for_tagging:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No valid question text found for auto-tagging."
        )

    try:
        ai_tags = await auto_tag_questions_with_groq(
            questions_for_tagging=questions_for_tagging,
            pdf_context=""
        )
    except HTTPException as error:
        error_text = str(error.detail).lower()

        if (
            "rate_limit" in error_text
            or "request too large" in error_text
            or "tokens" in error_text
            or "413" in error_text
        ):
            # Fallback keeps the feature working even if Groq token/TPM limit is hit.
            ai_tags = []
        else:
            raise

    tags_by_index = {
        tag["question_index"]: tag
        for tag in ai_tags
        if isinstance(tag.get("question_index"), int)
    }

    current_time = now_iso()
    tagged_count = 0

    for item in questions_for_tagging:
        question_index = item["question_index"]
        question_text = item["question"]

        tag = tags_by_index.get(question_index)

        if not tag:
            tag = basic_auto_tag_question(question_text)

        questions[question_index]["difficulty"] = safe_normalize_difficulty(
            tag.get("difficulty", "medium")
        )

        questions[question_index]["is_important"] = bool(
            tag.get("is_important", False)
        )

        questions[question_index]["topic_tag"] = (
            normalize_topic_tag(tag.get("topic_tag", "")) or "Machine Learning"
        )

        questions[question_index]["auto_tagged_at"] = current_time

        if "ai_generated_answer" not in questions[question_index]:
            questions[question_index]["ai_generated_answer"] = ""

        if "ai_answer_generated_at" not in questions[question_index]:
            questions[question_index]["ai_answer_generated_at"] = ""

        tagged_count += 1

    await assignments_collection.update_one(
        {
            "_id": ObjectId(assignment_id),
            "user_id": user_id
        },
        {
            "$set": {
                "questions": questions,
                "auto_tagged_at": current_time,
                "difficulty_updated_at": current_time,
                "updated_at": current_time
            }
        }
    )

    updated_assignment = await assignments_collection.find_one({
        "_id": ObjectId(assignment_id),
        "user_id": user_id
    })

    remaining_untagged = sum(
        1
        for question in questions
        if not str(question.get("topic_tag", "")).strip()
    )

    return {
        "success": True,
        "message": "Questions auto-tagged successfully",
        "tagged_count": tagged_count,
        "remaining_untagged": remaining_untagged,
        "assignment": await serialize_assignment(updated_assignment)
    }


@router.patch("/{assignment_id}/questions/generate-ai-answer")
async def generate_question_ai_answer(
    assignment_id: str,
    answer_request: QuestionAIAnswerRequest,
    current_user: dict = Depends(get_current_user)
):
    user_id = get_user_id(current_user)

    if not ObjectId.is_valid(assignment_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid assignment_id"
        )

    assignment = await assignments_collection.find_one({
        "_id": ObjectId(assignment_id),
        "user_id": user_id
    })

    if not assignment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assignment not found"
        )

    questions = assignment.get("questions", [])

    if not questions:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No extracted questions found. Please extract questions first."
        )

    question_index = answer_request.question_index

    if question_index < 0 or question_index >= len(questions):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid question index"
        )

    question_text = str(questions[question_index].get("question", "")).strip()

    if not question_text:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Question text is missing."
        )

    difficulty = str(
        questions[question_index].get("difficulty", "medium")
    ).strip().lower()

    if difficulty not in {"easy", "medium", "hard"}:
        difficulty = "medium"

    ai_answer = await generate_ai_answer_with_groq(
        question_text=question_text,
        pdf_context=assignment.get("pdf_text", ""),
        difficulty=difficulty
    )

    current_time = now_iso()

    questions[question_index]["ai_generated_answer"] = ai_answer
    questions[question_index]["ai_answer_generated_at"] = current_time

    if "difficulty" not in questions[question_index]:
        questions[question_index]["difficulty"] = "medium"

    if "is_important" not in questions[question_index]:
        questions[question_index]["is_important"] = False

    if "topic_tag" not in questions[question_index]:
        questions[question_index]["topic_tag"] = ""

    if "auto_tagged_at" not in questions[question_index]:
        questions[question_index]["auto_tagged_at"] = ""

    await assignments_collection.update_one(
        {
            "_id": ObjectId(assignment_id),
            "user_id": user_id
        },
        {
            "$set": {
                "questions": questions,
                "ai_answers_updated_at": current_time,
                "updated_at": current_time
            }
        }
    )

    updated_assignment = await assignments_collection.find_one({
        "_id": ObjectId(assignment_id),
        "user_id": user_id
    })

    return {
        "success": True,
        "message": "AI answer generated and saved successfully",
        "question_index": question_index,
        "ai_generated_answer": ai_answer,
        "ai_answer_generated_at": current_time,
        "assignment": await serialize_assignment(updated_assignment)
    }


@router.patch("/{assignment_id}/questions/evaluate-answer")
async def evaluate_assignment_answer(
    assignment_id: str,
    evaluation_request: QuestionEvaluationRequest,
    current_user: dict = Depends(get_current_user)
):
    user_id = get_user_id(current_user)

    if not ObjectId.is_valid(assignment_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid assignment_id"
        )

    assignment = await assignments_collection.find_one({
        "_id": ObjectId(assignment_id),
        "user_id": user_id
    })

    if not assignment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assignment not found"
        )

    questions = assignment.get("questions", [])

    if not questions:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No extracted questions found. Please extract questions first."
        )

    question_index = evaluation_request.question_index

    if question_index < 0 or question_index >= len(questions):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid question index"
        )

    student_answer = evaluation_request.student_answer.strip()

    if not student_answer:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Student answer is required before evaluation."
        )

    question_text = str(questions[question_index].get("question", "")).strip()

    if not question_text:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Question text is missing."
        )

    evaluation = await evaluate_answer_with_groq(
        question_text=question_text,
        student_answer=student_answer,
        pdf_context=assignment.get("pdf_text", "")
    )

    current_time = now_iso()

    questions[question_index]["student_answer"] = student_answer
    questions[question_index]["answered_at"] = current_time

    questions[question_index]["ai_score"] = evaluation["ai_score"]
    questions[question_index]["score"] = evaluation["ai_score"]
    questions[question_index]["ai_feedback"] = evaluation["ai_feedback"]
    questions[question_index]["strengths"] = evaluation["strengths"]
    questions[question_index]["missing_points"] = evaluation["missing_points"]
    questions[question_index]["improved_answer"] = evaluation["improved_answer"]
    questions[question_index]["evaluated_at"] = current_time

    if "difficulty" not in questions[question_index]:
        questions[question_index]["difficulty"] = "medium"

    if "is_important" not in questions[question_index]:
        questions[question_index]["is_important"] = False

    if "ai_generated_answer" not in questions[question_index]:
        questions[question_index]["ai_generated_answer"] = ""

    if "ai_answer_generated_at" not in questions[question_index]:
        questions[question_index]["ai_answer_generated_at"] = ""

    if "topic_tag" not in questions[question_index]:
        questions[question_index]["topic_tag"] = ""

    if "auto_tagged_at" not in questions[question_index]:
        questions[question_index]["auto_tagged_at"] = ""

    await assignments_collection.update_one(
        {"_id": ObjectId(assignment_id), "user_id": user_id},
        {
            "$set": {
                "questions": questions,
                "answers_updated_at": current_time,
                "evaluations_updated_at": current_time,
                "updated_at": current_time
            }
        }
    )

    updated_assignment = await assignments_collection.find_one({
        "_id": ObjectId(assignment_id),
        "user_id": user_id
    })

    return {
        "success": True,
        "message": "Answer evaluated and saved successfully",
        "question_index": question_index,
        "evaluation": {
            **evaluation,
            "evaluated_at": current_time
        },
        "assignment": await serialize_assignment(updated_assignment)
    }


@router.get("/{assignment_id}/generate-pdf")
async def generate_assignment_pdf(
    assignment_id: str,
    current_user: dict = Depends(get_current_user)
):
    user_id = get_user_id(current_user)

    if not ObjectId.is_valid(assignment_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid assignment_id"
        )

    assignment = await assignments_collection.find_one({
        "_id": ObjectId(assignment_id),
        "user_id": user_id
    })

    if not assignment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assignment not found"
        )

    questions = assignment.get("questions", [])

    if not questions:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No extracted questions found. Please extract questions first."
        )

    subject_name = await get_subject_name(
        str(assignment.get("subject_id", "")),
        user_id
    )

    buffer = io.BytesIO()

    pdf = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=40,
        leftMargin=40,
        topMargin=40,
        bottomMargin=40
    )

    styles = getSampleStyleSheet()
    story = []

    serialized = await serialize_assignment(assignment)

    title = assignment.get("title", "Assignment")
    due_date = assignment.get("due_date", "No due date")
    pdf_filename = assignment.get("pdf_filename", "No PDF uploaded")

    story.append(Paragraph("CampusAgent AI - Assignment Answer Sheet", styles["Title"]))
    story.append(Spacer(1, 14))

    story.append(Paragraph(f"<b>Assignment:</b> {safe_pdf_text(title)}", styles["Normal"]))
    story.append(Paragraph(f"<b>Subject:</b> {safe_pdf_text(subject_name)}", styles["Normal"]))
    story.append(Paragraph(f"<b>Due Date:</b> {safe_pdf_text(due_date)}", styles["Normal"]))
    story.append(Paragraph(f"<b>Source PDF:</b> {safe_pdf_text(pdf_filename)}", styles["Normal"]))
    story.append(Paragraph(f"<b>Total Questions:</b> {serialized['questions_count']}", styles["Normal"]))
    story.append(Paragraph(f"<b>Answered:</b> {serialized['answered_count']}", styles["Normal"]))
    story.append(Paragraph(f"<b>Completion:</b> {serialized['completion_percentage']}%", styles["Normal"]))
    story.append(Paragraph(
        f"<b>Generated At:</b> {datetime.now().strftime('%d %B %Y, %I:%M %p')}",
        styles["Normal"]
    ))

    story.append(Spacer(1, 20))

    for index, question in enumerate(questions, start=1):
        question_text = str(question.get("question", "")).strip()
        student_answer = str(question.get("student_answer", "")).strip()

        if not student_answer:
            student_answer = "Not answered yet."

        story.append(
            Paragraph(
                f"<b>Q{index}. {safe_pdf_text(question_text)}</b>",
                styles["Heading3"]
            )
        )
        story.append(Spacer(1, 6))

        story.append(Paragraph("<b>Student Answer:</b>", styles["Normal"]))
        story.append(Paragraph(safe_pdf_text(student_answer), styles["Normal"]))

        story.append(Spacer(1, 16))

    pdf.build(story)

    buffer.seek(0)

    safe_title = "".join(
        char if char.isalnum() or char in ["-", "_"] else "_"
        for char in title
    )

    filename = f"{safe_title}_answers.pdf"

    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"'
        }
    )


@router.delete("/{assignment_id}/delete-pdf")
async def delete_assignment_pdf(
    assignment_id: str,
    current_user: dict = Depends(get_current_user)
):
    user_id = get_user_id(current_user)

    if not ObjectId.is_valid(assignment_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid assignment_id"
        )

    assignment = await assignments_collection.find_one({
        "_id": ObjectId(assignment_id),
        "user_id": user_id
    })

    if not assignment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assignment not found"
        )

    if not assignment.get("pdf_text") and not assignment.get("pdf_filename"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No PDF found for this assignment"
        )

    current_time = now_iso()

    await assignments_collection.update_one(
        {"_id": ObjectId(assignment_id), "user_id": user_id},
        {
            "$set": {
                "pdf_filename": "",
                "pdf_text": "",
                "pdf_uploaded_at": "",
                "questions": [],
                "questions_extracted_at": "",
                "answers_updated_at": "",
                "evaluations_updated_at": "",
                "difficulty_updated_at": "",
                "ai_answers_updated_at": "",
                "auto_tagged_at": "",
                "updated_at": current_time
            }
        }
    )

    updated_assignment = await assignments_collection.find_one({
        "_id": ObjectId(assignment_id),
        "user_id": user_id
    })

    return {
        "success": True,
        "message": "PDF deleted successfully",
        "assignment": await serialize_assignment(updated_assignment)
    }


@router.delete("/{assignment_id}")
async def delete_assignment(
    assignment_id: str,
    current_user: dict = Depends(get_current_user)
):
    user_id = get_user_id(current_user)

    if not ObjectId.is_valid(assignment_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid assignment_id"
        )

    result = await assignments_collection.delete_one({
        "_id": ObjectId(assignment_id),
        "user_id": user_id
    })

    if result.deleted_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assignment not found"
        )

    return {
        "success": True,
        "message": "Assignment deleted successfully"
    }