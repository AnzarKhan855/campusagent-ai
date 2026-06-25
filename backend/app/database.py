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

users_collection = database["users"]
subjects_collection = database["subjects"]
assignments_collection = database["assignments"]
attendance_collection = database["attendance"]
notes_collection = database["notes"]
study_plans_collection = database["study_plans"]
tasks_collection = database["tasks"]
reminders_collection = database["reminders"]
quizzes_collection = database["quizzes"]
agent_actions_collection = database["agent_actions"]
agent_memory_collection = database["agent_memory"]
notifications_collection = database["notifications"]