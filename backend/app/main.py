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
def health_check():
    return {
        "status": "ok",
        "service": "CampusAgent AI Backend"
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