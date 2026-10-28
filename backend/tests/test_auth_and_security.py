import pytest
import uuid
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.auth import hash_password, verify_password, create_access_token
from app.database import users_collection, subjects_collection, attendance_collection


@pytest.mark.asyncio
async def test_password_hashing():
    raw_pass = "SecurePass123!"
    hashed = hash_password(raw_pass)
    assert hashed != raw_pass
    assert verify_password(raw_pass, hashed) is True
    assert verify_password("WrongPassword!", hashed) is False


@pytest.mark.asyncio
async def test_jwt_token_creation_and_payload():
    test_sub = f"test_user_{uuid.uuid4().hex[:8]}@example.com"
    token = create_access_token({"sub": test_sub})
    assert isinstance(token, str)
    assert len(token) > 20


@pytest.mark.asyncio
async def test_signup_validation_and_duplicate():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Missing fields should return 422
        res = await client.post("/api/auth/signup", json={})
        assert res.status_code == 422
        body = res.json()
        assert "detail" in body

        # 2. Password too short (< 8 chars)
        res = await client.post("/api/auth/signup", json={
            "name": "Short Pass User",
            "email": f"short_{uuid.uuid4().hex[:6]}@example.com",
            "password": "123",
            "role": "student"
        })
        assert res.status_code == 422

        # 3. Valid Signup
        unique_email = f"student_{uuid.uuid4().hex[:8]}@example.com"
        res = await client.post("/api/auth/signup", json={
            "name": "Test Student",
            "email": unique_email,
            "password": "StrongPassword123!",
            "role": "student"
        })
        assert res.status_code == 200
        data = res.json()
        assert "access_token" in data
        assert data["user"]["email"] == unique_email
        token = data["access_token"]

        # 4. Duplicate Signup should return 400 Bad Request with clear message
        res_dup = await client.post("/api/auth/signup", json={
            "name": "Duplicate User",
            "email": unique_email,
            "password": "StrongPassword123!",
            "role": "student"
        })
        assert res_dup.status_code == 400
        assert "already registered" in res_dup.json()["detail"].lower()

        # 5. Login with created credentials
        res_login = await client.post("/api/auth/login", json={
            "email": unique_email,
            "password": "StrongPassword123!"
        })
        assert res_login.status_code == 200
        assert "access_token" in res_login.json()

        # 6. Login with invalid password
        res_fail = await client.post("/api/auth/login", json={
            "email": unique_email,
            "password": "IncorrectPassword"
        })
        assert res_fail.status_code == 401

        # 7. Access /api/auth/me with Bearer token
        res_me = await client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert res_me.status_code == 200
        assert res_me.json()["user"]["email"] == unique_email


@pytest.mark.asyncio
async def test_cross_user_isolation_security():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Create User A
        email_a = f"usera_{uuid.uuid4().hex[:8]}@example.com"
        res_a = await client.post("/api/auth/signup", json={
            "name": "User Alpha",
            "email": email_a,
            "password": "PasswordAlpha123!",
            "role": "student"
        })
        token_a = res_a.json()["access_token"]

        # Create User B
        email_b = f"userb_{uuid.uuid4().hex[:8]}@example.com"
        res_b = await client.post("/api/auth/signup", json={
            "name": "User Beta",
            "email": email_b,
            "password": "PasswordBeta123!",
            "role": "student"
        })
        token_b = res_b.json()["access_token"]

        # User A creates a subject
        res_sub_a = await client.post("/api/subjects", json={
            "name": "Alpha Confidential Robotics",
            "code": "ROB-901",
            "color": "emerald"
        }, headers={"Authorization": f"Bearer {token_a}"})
        assert res_sub_a.status_code == 200
        subject_a_id = res_sub_a.json()["subject"]["id"]

        # User B queries their subjects list - should NOT see User A's subject
        res_subs_b = await client.get("/api/subjects", headers={"Authorization": f"Bearer {token_b}"})
        assert res_subs_b.status_code == 200
        subject_names_b = [s["name"] for s in res_subs_b.json()["subjects"]]
        assert "Alpha Confidential Robotics" not in subject_names_b

        # User B attempts to delete User A's subject - must be 404 Not Found (ownership check)
        res_del = await client.delete(f"/api/subjects/{subject_a_id}", headers={"Authorization": f"Bearer {token_b}"})
        assert res_del.status_code == 404

        # Clean up User A's subject using User A's token
        res_del_a = await client.delete(f"/api/subjects/{subject_a_id}", headers={"Authorization": f"Bearer {token_a}"})
        assert res_del_a.status_code == 200
