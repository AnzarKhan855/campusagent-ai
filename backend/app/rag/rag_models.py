from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class RagDocumentCreate(BaseModel):
    user_id: str
    filename: str
    original_filename: str
    chunks_created: int
    qdrant_collection: str
    created_at: datetime = Field(default_factory=datetime.utcnow)


class RagDocumentResponse(BaseModel):
    id: str
    filename: str
    original_filename: str
    chunks_created: int
    qdrant_collection: str
    created_at: datetime


class RagDocumentRename(BaseModel):
    filename: str