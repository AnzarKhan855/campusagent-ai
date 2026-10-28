import pytest
import uuid
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.routes_attendance import calculate_attendance_stats


def test_attendance_math_safe():
    # 9 attended out of 10 held, 75% required -> 90% (Safe: >= 85%)
    stats_safe = calculate_attendance_stats(total_classes=10, attended_classes=9, required_percentage=75.0)
    assert stats_safe["current_percentage"] == 90.0
    assert stats_safe["risk_status"] == "safe"
    # floor(900 / 75) - 10 = 12 - 10 = 2 classes can miss
    assert stats_safe["classes_can_miss"] == 2
    assert stats_safe["classes_needed"] == 0

    # 8 attended out of 10 held, 75% required -> 80% (Warning: 75% <= x < 85%)
    stats_warn = calculate_attendance_stats(total_classes=10, attended_classes=8, required_percentage=75.0)
    assert stats_warn["current_percentage"] == 80.0
    assert stats_warn["risk_status"] == "warning"
    assert stats_warn["classes_can_miss"] == 0
    assert stats_warn["classes_needed"] == 0

    # 18 attended out of 20 held, 75% required -> 90% (Safe)
    # floor(1800 / 75) - 20 = 24 - 20 = 4 classes can miss
    stats2 = calculate_attendance_stats(total_classes=20, attended_classes=18, required_percentage=75.0)
    assert stats2["current_percentage"] == 90.0
    assert stats2["risk_status"] == "safe"
    assert stats2["classes_can_miss"] == 4


def test_attendance_math_danger_recovery():
    # 6 attended out of 10 held, 75% required -> 60% (Danger)
    # Required recovery: ceil(((75 * 10) - (100 * 6)) / (100 - 75)) = ceil((750 - 600) / 25) = ceil(150 / 25) = 6 classes
    stats = calculate_attendance_stats(total_classes=10, attended_classes=6, required_percentage=75.0)
    assert stats["current_percentage"] == 60.0
    assert stats["risk_status"] == "danger"
    assert stats["classes_can_miss"] == 0
    assert stats["classes_needed"] == 6


def test_attendance_math_zero_classes():
    stats = calculate_attendance_stats(total_classes=0, attended_classes=0, required_percentage=75.0)
    assert stats["current_percentage"] == 0.0
    assert stats["risk_status"] == "neutral"


@pytest.mark.asyncio
async def test_attendance_api_workflow():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Create user
        email = f"att_test_{uuid.uuid4().hex[:8]}@example.com"
        res_signup = await client.post("/api/auth/signup", json={
            "name": "Attendance Student",
            "email": email,
            "password": "Password123!",
            "role": "student"
        })
        token = res_signup.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # Create Subject
        res_sub = await client.post("/api/subjects", json={
            "name": "Digital Signal Processing",
            "code": "DSP-301",
            "color": "blue"
        }, headers=headers)
        sub_id = res_sub.json()["subject"]["id"]

        # Validate attended > total classes error (400)
        res_invalid = await client.post("/api/attendance", json={
            "subject_id": sub_id,
            "total_classes": 5,
            "attended_classes": 10,
            "required_percentage": 75.0
        }, headers=headers)
        assert res_invalid.status_code == 400

        # Create valid attendance: 10 held, 8 attended
        res_att = await client.post("/api/attendance", json={
            "subject_id": sub_id,
            "total_classes": 10,
            "attended_classes": 8,
            "required_percentage": 75.0
        }, headers=headers)
        assert res_att.status_code == 200
        att_id = res_att.json()["attendance"]["id"]
        assert res_att.json()["attendance"]["current_percentage"] == 80.0

        # Attempt duplicate attendance for same subject (should be 400)
        res_dup = await client.post("/api/attendance", json={
            "subject_id": sub_id,
            "total_classes": 12,
            "attended_classes": 10,
            "required_percentage": 75.0
        }, headers=headers)
        assert res_dup.status_code == 400

        # Update attendance: 12 held, 9 attended -> 75% (warning)
        res_upd = await client.put(f"/api/attendance/{att_id}", json={
            "total_classes": 12,
            "attended_classes": 9,
            "required_percentage": 75.0
        }, headers=headers)
        assert res_upd.status_code == 200
        assert res_upd.json()["attendance"]["current_percentage"] == 75.0
        assert res_upd.json()["attendance"]["risk_status"] == "warning"

        # Delete attendance
        res_del = await client.delete(f"/api/attendance/{att_id}", headers=headers)
        assert res_del.status_code == 200
