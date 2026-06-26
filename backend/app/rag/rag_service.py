import os
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv
from fastapi import HTTPException, UploadFile
from groq import Groq
from pdfminer.high_level import extract_text

from app.rag.chunker import chunk_text
from app.rag.embeddings import get_embeddings, get_single_embedding
from app.rag.pdf_library_service import create_rag_document
from app.rag.vector_store import add_chunks_to_qdrant, search_similar_chunks


load_dotenv()

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "").strip()

if not GROQ_API_KEY:
    raise RuntimeError("GROQ_API_KEY is missing in .env or Render environment")

groq_client = Groq(api_key=GROQ_API_KEY)

QDRANT_COLLECTION_NAME = "campusagent_rag"


async def upload_pdf_to_rag(file: UploadFile, user_id: str):
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are allowed")

    upload_dir = Path("uploaded_rag_pdfs")
    upload_dir.mkdir(parents=True, exist_ok=True)

    safe_filename = Path(file.filename).name
    file_path = upload_dir / safe_filename

    try:
        file_bytes = await file.read()

        if not file_bytes:
            raise HTTPException(status_code=400, detail="Uploaded PDF is empty")

        with open(file_path, "wb") as buffer:
            buffer.write(file_bytes)

        extracted_text = extract_text(str(file_path))

        if not extracted_text or len(extracted_text.strip()) < 50:
            raise HTTPException(
                status_code=400,
                detail="Could not extract enough text from PDF",
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

        add_chunks_to_qdrant(
            chunks=chunks,
            embeddings=embeddings,
            user_id=user_id,
            document_id=document["id"],
            filename=safe_filename,
        )

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

        response = groq_client.chat.completions.create(
            model="llama-3.1-8b-instant",
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

        answer = response.choices[0].message.content

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