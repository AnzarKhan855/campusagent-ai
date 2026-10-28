import pytest
import uuid
from httpx import AsyncClient, ASGITransport
from app.main import app


@pytest.mark.asyncio
async def test_dashboard_and_ai_command_workflow():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Signup test user
        email = f"e2e_student_{uuid.uuid4().hex[:8]}@example.com"
        res_signup = await client.post("/api/auth/signup", json={
            "name": "E2E Student",
            "email": email,
            "password": "Password123!",
            "role": "student"
        })
        assert res_signup.status_code == 200
        token = res_signup.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # 2. Check Empty Dashboard Overview
        res_dash = await client.get("/api/dashboard/overview", headers=headers)
        assert res_dash.status_code == 200
        dash_data = res_dash.json()
        assert "overview" in dash_data
        assert dash_data["overview"]["total_subjects"] == 0
        assert dash_data["overview"]["total_assignments"] == 0

        # 3. Create Subject
        res_sub = await client.post("/api/subjects", json={
            "name": "Operating Systems",
            "code": "CS-302",
            "color": "indigo"
        }, headers=headers)
        assert res_sub.status_code == 200
        sub_id = res_sub.json()["subject"]["id"]

        # 4. Log Attendance (8/10 = 80%)
        res_att = await client.post("/api/attendance", json={
            "subject_id": sub_id,
            "total_classes": 10,
            "attended_classes": 8,
            "required_percentage": 75.0
        }, headers=headers)
        assert res_att.status_code == 200

        # 5. Create Assignment with Questions
        res_asg = await client.post("/api/assignments", json={
            "title": "Process Synchronization",
            "subject_id": sub_id,
            "due_date": "2026-11-20",
            "priority": "high",
            "description": "Critical sections, semaphores and mutexes."
        }, headers=headers)
        assert res_asg.status_code == 200
        asg_id = res_asg.json()["assignment"]["id"]

        # 6. Add Questions to Assignment via patch
        sample_questions = [
            {
                "question": "What is the critical section problem in operating systems?",
                "topic_tag": "Process Synchronization",
                "difficulty": "medium",
                "is_important": True,
                "student_answer": "",
                "ai_score": None
            },
            {
                "question": "Differentiate between binary semaphore and counting semaphore.",
                "topic_tag": "Semaphores",
                "difficulty": "easy",
                "is_important": False,
                "student_answer": "",
                "ai_score": None
            }
        ]
        # In MongoDB, assignment questions are set directly or via PDF extraction. We can create practice test directly or verify dashboard.
        # Let's verify dashboard overview with 1 subject, 1 assignment, 1 attendance record
        res_dash2 = await client.get("/api/dashboard/overview", headers=headers)
        assert res_dash2.status_code == 200
        dash_data2 = res_dash2.json()
        assert dash_data2["overview"]["total_subjects"] == 1
        assert dash_data2["overview"]["total_assignments"] == 1
        assert dash_data2["overview"]["pending_assignments"] == 1

        # 7. Test AI Agent Command: "lowest attendance"
        res_cmd_att = await client.post("/api/ai/command", json={
            "command": "what is my lowest attendance subject?"
        }, headers=headers)
        assert res_cmd_att.status_code == 200
        cmd_att_data = res_cmd_att.json()
        assert cmd_att_data["success"] is True
        assert "Operating Systems" in cmd_att_data["answer"]
        assert "80" in cmd_att_data["answer"]

        # 8. Test AI Agent Command: "pending assignments"
        res_cmd_asg = await client.post("/api/ai/command", json={
            "command": "show my pending assignments"
        }, headers=headers)
        assert res_cmd_asg.status_code == 200
        cmd_asg_data = res_cmd_asg.json()
        assert cmd_asg_data["success"] is True
        assert "Process Synchronization" in cmd_asg_data["answer"]

        # 9. Test AI Agent Command: "plan my day"
        res_cmd_plan = await client.post("/api/ai/command", json={
            "command": "plan my day"
        }, headers=headers)
        assert res_cmd_plan.status_code == 200
        cmd_plan_data = res_cmd_plan.json()
        assert cmd_plan_data["success"] is True
        assert "plan" in cmd_plan_data
        assert "Process Synchronization" in cmd_plan_data["plan"]["todays_priority"]

        # 10. Test RAG documents listing
        res_rag_docs = await client.get("/api/rag/documents", headers=headers)
        assert res_rag_docs.status_code == 200
        assert "documents" in res_rag_docs.json()
