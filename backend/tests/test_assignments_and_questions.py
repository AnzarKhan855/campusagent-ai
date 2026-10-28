import pytest
import uuid
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.routes_assignments import (
    extract_questions_from_pdf_text,
    basic_auto_tag_question,
    normalize_difficulty,
    normalize_score,
)


def test_question_extraction_algorithm():
    sample_text = """
    Q1. Explain the working principle of Support Vector Machines (SVM) with a diagram.
    Q2. Define Naive Bayes classifier and explain how prior probability is computed.
    Q3. What is the difference between supervised and unsupervised learning?
    4. Write short notes on K-Nearest Neighbors (KNN).
    """
    questions = extract_questions_from_pdf_text(sample_text)
    assert len(questions) == 4
    assert "Support Vector Machines" in questions[0]["question"]
    assert "Naive Bayes" in questions[1]["question"]
    assert "supervised" in questions[2]["question"]
    assert "K-Nearest Neighbors" in questions[3]["question"]


def test_auto_tagging_rules():
    tag_svm = basic_auto_tag_question("Explain the optimal margin hyperplane in Support Vector Machines")
    assert tag_svm["topic_tag"] == "SVM"
    assert tag_svm["is_important"] is True

    tag_knn = basic_auto_tag_question("What is k-nearest neighbor algorithm?")
    assert tag_knn["topic_tag"] == "KNN"

    tag_cnn = basic_auto_tag_question("Draw the architecture of a convolutional neural network (CNN)")
    assert tag_cnn["topic_tag"] == "CNN"
    assert tag_cnn["difficulty"] == "hard"

    tag_def = basic_auto_tag_question("Define machine learning.")
    assert tag_def["difficulty"] == "easy"


def test_score_normalization():
    assert normalize_score(8) == 8
    assert normalize_score("Score: 9/10") == 9
    assert normalize_score("15") == 10  # Clamped to 10
    assert normalize_score("-3") == 0   # Clamped to 0
    assert normalize_score(None) is None


@pytest.mark.asyncio
async def test_assignment_crud_and_question_answers():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Create user
        email = f"asg_test_{uuid.uuid4().hex[:8]}@example.com"
        res_signup = await client.post("/api/auth/signup", json={
            "name": "Assignment Tester",
            "email": email,
            "password": "Password123!",
            "role": "student"
        })
        token = res_signup.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # Create Subject
        res_sub = await client.post("/api/subjects", json={
            "name": "Machine Learning",
            "code": "CS-401"
        }, headers=headers)
        sub_id = res_sub.json()["subject"]["id"]

        # Create Assignment
        res_asg = await client.post("/api/assignments", json={
            "title": "ML Unit 1 Questions",
            "subject_id": sub_id,
            "due_date": "2026-11-15",
            "priority": "high",
            "description": "Prepare assignment answers from Unit 1 syllabus"
        }, headers=headers)
        assert res_asg.status_code == 200
        asg_id = res_asg.json()["assignment"]["id"]

        # Update assignment status
        res_patch = await client.patch(f"/api/assignments/{asg_id}", json={
            "status": "in_progress"
        }, headers=headers)
        assert res_patch.status_code == 200
        assert res_patch.json()["assignment"]["status"] == "in_progress"

        # List assignments
        res_list = await client.get("/api/assignments", headers=headers)
        assert res_list.status_code == 200
        assert len(res_list.json()["assignments"]) >= 1

        # Delete assignment
        res_del = await client.delete(f"/api/assignments/{asg_id}", headers=headers)
        assert res_del.status_code == 200
