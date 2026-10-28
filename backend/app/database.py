import os
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

load_dotenv()

MONGODB_URL = os.getenv("MONGODB_URL")
DATABASE_NAME = os.getenv("DATABASE_NAME")

if not MONGODB_URL:
    raise ValueError("MONGODB_URL is missing in .env file")

if not DATABASE_NAME:
    raise ValueError("DATABASE_NAME is missing in .env file")

client = AsyncIOMotorClient(MONGODB_URL)
database = client[DATABASE_NAME]

# ==========================================
# Active Production Collections
# ==========================================
users_collection = database["users"]
subjects_collection = database["subjects"]
assignments_collection = database["assignments"]
attendance_collection = database["attendance"]
practice_tests_collection = database["practice_tests"]
rag_documents_collection = database["rag_documents"]

# ==========================================
# Roadmap / Reserved Placeholders
# (Retained for backwards-compatibility; no active endpoints)
# ==========================================
notes_collection = database["notes"]
study_plans_collection = database["study_plans"]
tasks_collection = database["tasks"]
reminders_collection = database["reminders"]
quizzes_collection = database["quizzes"]
agent_actions_collection = database["agent_actions"]
agent_memory_collection = database["agent_memory"]
notifications_collection = database["notifications"]


async def init_db_indexes():
    """Ensure performant indexes on all active collections."""
    try:
        await users_collection.create_index("email", unique=True)
        await subjects_collection.create_index("user_id")
        await assignments_collection.create_index([("user_id", 1), ("due_date", 1)])
        await attendance_collection.create_index([("user_id", 1), ("subject_id", 1)], unique=True)
        await practice_tests_collection.create_index([("user_id", 1), ("created_at", -1)])
        await rag_documents_collection.create_index([("user_id", 1), ("created_at", -1)])
    except Exception:
        # Ignore if index already exists or background conflict
        pass