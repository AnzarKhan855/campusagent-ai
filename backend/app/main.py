import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import database
from app.routes_auth import router as auth_router
from app.routes_subjects import router as subjects_router
from app.routes_assignments import router as assignments_router
from app.routes_attendance import router as attendance_router
from app.routes_dashboard import router as dashboard_router
from app.routes_ai import router as ai_router
from app.routes_practice_tests import router as practice_tests_router
from app.rag.rag_routes import router as rag_router


app = FastAPI(
    title="CampusAgent AI API",
    description="Backend API for CampusAgent AI student productivity platform",
    version="1.0.0",
)

origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://campusagent-ai.vercel.app",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(subjects_router)
app.include_router(assignments_router)
app.include_router(attendance_router)
app.include_router(dashboard_router)
app.include_router(ai_router)
app.include_router(practice_tests_router)
app.include_router(rag_router)

@app.get("/")
def home():
    return {
        "message": "CampusAgent AI backend is running successfully"
    }


@app.get("/health")
async def health_check():
    db_status = "connected"
    try:
        await database.command("ping")
    except Exception as e:
        db_status = f"error: {str(e)}"

    from app.rag.vector_store import ping_vector_store
    vector_health = ping_vector_store()

    is_db_ok = db_status == "connected"
    is_vector_ok = vector_health.get("connectivity") == "connected"
    is_remote = vector_health.get("persistent", False)

    is_healthy = is_db_ok and is_vector_ok

    persistence_note = (
        "persistent_cloud"
        if is_remote
        else "ephemeral_container_disk (P0 persistence risk: vectors erased on container restart)"
    )

    return {
        "status": "healthy" if is_healthy else "degraded",
        "service": "CampusAgent AI Backend",
        "database": db_status,
        "vector_store": vector_health.get("mode"),
        "vector_connectivity": vector_health.get("connectivity"),
        "persistence": persistence_note,
        "version": "1.0.0"
    }


@app.get("/ready")
async def readiness_check():
    db_status = "connected"
    try:
        await database.command("ping")
    except Exception as e:
        db_status = f"error: {str(e)}"

    from app.rag.vector_store import ping_vector_store
    vector_health = ping_vector_store()

    is_db_ok = db_status == "connected"
    is_vector_ok = vector_health.get("connectivity") == "connected"
    is_persistent = vector_health.get("persistent", False)

    ready = is_db_ok and is_vector_ok and is_persistent

    blockers = []
    if not is_db_ok:
        blockers.append("MongoDB connection failure")
    if not is_vector_ok:
        blockers.append(f"Vector store unreachable: {vector_health.get('connectivity')}")
    if not is_persistent:
        blockers.append("QDRANT_URL and QDRANT_API_KEY not configured (ephemeral storage P0 blocker)")

    return {
        "ready": ready,
        "service": "CampusAgent AI Backend",
        "database": db_status,
        "vector_store": vector_health.get("mode"),
        "vector_connectivity": vector_health.get("connectivity"),
        "persistent": is_persistent,
        "blockers": blockers
    }


@app.get("/db-test")
async def db_test():
    try:
        collections = await database.list_collection_names()
        return {
            "status": "success",
            "message": "MongoDB connected successfully",
            "database": database.name,
            "collections": collections,
        }
    except Exception as e:
        return {
            "status": "error",
            "message": "MongoDB connection failed",
            "error": str(e),
        }