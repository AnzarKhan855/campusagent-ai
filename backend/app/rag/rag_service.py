import io
import os
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv
from fastapi import HTTPException, UploadFile
from pdfminer.high_level import extract_text

from app.ai_config import generate_chat_completion
from app.rag.chunker import chunk_text
from app.rag.embeddings import get_embeddings, get_single_embedding
from app.rag.pdf_library_service import (
    create_rag_document,
    get_rag_document_by_id,
    delete_rag_document_metadata,
)
from app.rag.vector_store import add_chunks_to_qdrant, search_similar_chunks


load_dotenv()

QDRANT_COLLECTION_NAME = "campusagent_rag"
MAX_PDF_FILE_SIZE = 10 * 1024 * 1024  # 10 MB


async def upload_pdf_to_rag(file: UploadFile, user_id: str):
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are allowed")

    safe_filename = Path(file.filename).name

    try:
        file_bytes = await file.read()

        if not file_bytes:
            raise HTTPException(status_code=400, detail="Uploaded PDF is empty")

        if len(file_bytes) > MAX_PDF_FILE_SIZE:
            raise HTTPException(
                status_code=400,
                detail="PDF too large. Please upload a file smaller than 10 MB."
            )

        try:
            extracted_text = extract_text(io.BytesIO(file_bytes))
        except Exception as parse_error:
            raise HTTPException(
                status_code=400,
                detail=f"Could not parse PDF: {str(parse_error)}"
            )

        if not extracted_text or len(extracted_text.strip()) < 50:
            raise HTTPException(
                status_code=400,
                detail="Could not extract enough text from PDF (minimum 50 characters required). Scanned or image-only PDFs are not supported.",
            )

        chunks = chunk_text(extracted_text)

        if not chunks:
            raise HTTPException(
                status_code=400,
                detail="No chunks created from PDF",
            )

        embeddings = await get_embeddings(chunks)

        if len(embeddings) != len(chunks):
            raise HTTPException(
                status_code=500,
                detail="Embedding count does not match chunk count",
            )

        document = await create_rag_document(
            user_id=user_id,
            filename=safe_filename,
            original_filename=safe_filename,
            chunks_created=len(chunks),
            qdrant_collection=QDRANT_COLLECTION_NAME,
        )

        try:
            add_chunks_to_qdrant(
                chunks=chunks,
                embeddings=embeddings,
                user_id=user_id,
                document_id=document["id"],
                filename=safe_filename,
            )
        except Exception as qdrant_error:
            # ROLLBACK: Delete the MongoDB document metadata so no ghost/orphan record remains
            await delete_rag_document_metadata(document["id"], user_id)
            raise HTTPException(
                status_code=500,
                detail=f"Vector storage failed: {str(qdrant_error)}. Rolled back document metadata.",
            ) from qdrant_error

        return {
            "success": True,
            "message": "PDF uploaded, stored, embedded, and saved in PDF Library",
            "document": document,
            "chunks_created": len(chunks),
        }

    except HTTPException:
        raise

    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"RAG upload failed: {str(error)}",
        )


async def ask_rag_question(
    question: str,
    user_id: str,
    document_id: Optional[str] = None,
):
    if not question or not question.strip():
        raise HTTPException(status_code=400, detail="Question is required")

    if document_id:
        await get_rag_document_by_id(document_id=document_id, user_id=user_id)

    try:
        query_embedding = await get_single_embedding(question)

        results = search_similar_chunks(
            query_embedding=query_embedding,
            user_id=user_id,
            document_id=document_id,
            limit=5,
        )

        if not results:
            return {
                "success": True,
                "answer": "I could not find relevant content in your uploaded PDFs.",
                "sources": [],
            }

        context_blocks = []
        sources = []

        for result in results:
            payload = result.payload or {}

            context_blocks.append(
                f"""
Source:
Filename: {payload.get("filename")}
Chunk Number: {payload.get("chunk_number")}
Content:
{payload.get("text")}
"""
            )

            sources.append(
                {
                    "filename": payload.get("filename"),
                    "document_id": payload.get("document_id"),
                    "chunk_number": payload.get("chunk_number"),
                    "preview": str(payload.get("text", ""))[:300],
                    "score": result.score,
                }
            )

        context = "\n\n".join(context_blocks)

        prompt = f"""
You are CampusAgent AI, a helpful academic study assistant.

Answer the student's question using only the provided PDF context.
If the answer is not present in the context, say that the answer is not available in the uploaded PDF.

Question:
{question}

PDF Context:
{context}
"""

        answer = await generate_chat_completion(
            messages=[
                {
                    "role": "system",
                    "content": "You are a helpful AI study assistant for B.Tech students.",
                },
                {
                    "role": "user",
                    "content": prompt,
                },
            ],
            temperature=0.2,
        )

        return {
            "success": True,
            "answer": answer,
            "sources": sources,
        }

    except HTTPException:
        raise

    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"RAG question failed: {str(error)}",
        )