from fastapi import APIRouter, UploadFile, File, Depends
from pydantic import BaseModel
from typing import Optional

from app.auth import get_current_user
from app.rag.rag_service import upload_pdf_to_rag, ask_rag_question
from app.rag.pdf_library_service import (
    get_user_rag_documents,
    rename_rag_document,
    delete_rag_document_metadata,
)
from app.rag.vector_store import delete_document_vectors


router = APIRouter(prefix="/api/rag", tags=["RAG"])


class RagQuestionRequest(BaseModel):
    question: str
    document_id: Optional[str] = None


class RenamePdfRequest(BaseModel):
    filename: str


@router.post("/upload")
async def upload_rag_pdf(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
):
    user_id = str(current_user["_id"])
    return await upload_pdf_to_rag(file=file, user_id=user_id)


@router.get("/documents")
async def list_rag_documents(
    current_user: dict = Depends(get_current_user),
):
    user_id = str(current_user["_id"])
    documents = await get_user_rag_documents(user_id)

    return {
        "success": True,
        "documents": documents,
    }


@router.patch("/documents/{document_id}/rename")
async def rename_rag_pdf(
    document_id: str,
    request: RenamePdfRequest,
    current_user: dict = Depends(get_current_user),
):
    user_id = str(current_user["_id"])

    updated_document = await rename_rag_document(
        document_id=document_id,
        user_id=user_id,
        new_filename=request.filename,
    )

    return {
        "success": True,
        "message": "PDF renamed successfully",
        "document": updated_document,
    }


@router.delete("/documents/{document_id}")
async def delete_rag_pdf(
    document_id: str,
    current_user: dict = Depends(get_current_user),
):
    user_id = str(current_user["_id"])

    delete_document_vectors(user_id=user_id, document_id=document_id)

    result = await delete_rag_document_metadata(
        document_id=document_id,
        user_id=user_id,
    )

    return result


@router.post("/ask")
async def ask_rag(
    request: RagQuestionRequest,
    current_user: dict = Depends(get_current_user),
):
    user_id = str(current_user["_id"])

    return await ask_rag_question(
        question=request.question,
        user_id=user_id,
        document_id=request.document_id,
    )