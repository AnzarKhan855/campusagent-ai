import os
from fastapi import UploadFile, HTTPException
from pdfminer.high_level import extract_text
from app.rag.chunker import chunk_text
from app.rag.embeddings import get_embeddings, get_single_embedding
from app.rag.vector_store import (
    add_chunks_to_qdrant,
    search_similar_chunks,
)
from app.rag.pdf_library_service import create_rag_document
from groq import Groq
from dotenv import load_dotenv


load_dotenv()

GROQ_API_KEY = os.getenv("GROQ_API_KEY")

if not GROQ_API_KEY:
    raise RuntimeError("GROQ_API_KEY is missing in .env")

groq_client = Groq(api_key=GROQ_API_KEY)


async def upload_pdf_to_rag(file: UploadFile, user_id: str):
    if not file.filename.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are allowed")

    upload_dir = "uploaded_rag_pdfs"
    os.makedirs(upload_dir, exist_ok=True)

    file_path = os.path.join(upload_dir, file.filename)

    with open(file_path, "wb") as buffer:
        buffer.write(await file.read())

    extracted_text = extract_text(file_path)

    if not extracted_text or len(extracted_text.strip()) < 50:
        raise HTTPException(status_code=400, detail="Could not extract enough text from PDF")

    chunks = chunk_text(extracted_text)

    if not chunks:
        raise HTTPException(status_code=400, detail="No chunks created from PDF")

    embeddings = get_embeddings(chunks)

    document = await create_rag_document(
        user_id=user_id,
        filename=file.filename,
        original_filename=file.filename,
        chunks_created=len(chunks),
        qdrant_collection="campusagent_rag",
    )

    add_chunks_to_qdrant(
        chunks=chunks,
        embeddings=embeddings,
        user_id=user_id,
        document_id=document["id"],
        filename=file.filename,
    )

    return {
        "success": True,
        "message": "PDF uploaded, stored, embedded, and saved in PDF Library",
        "document": document,
    }


async def ask_rag_question(
    question: str,
    user_id: str,
    document_id: str | None = None,
):
    query_embedding = get_single_embedding(question)

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
        payload = result.payload

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
                "preview": payload.get("text", "")[:300],
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