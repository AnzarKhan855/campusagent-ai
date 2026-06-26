from datetime import datetime
from bson import ObjectId
from fastapi import HTTPException
from app.database import database


rag_documents_collection = database["rag_documents"]


def serialize_rag_document(doc):
    return {
        "id": str(doc["_id"]),
        "filename": doc.get("filename"),
        "original_filename": doc.get("original_filename"),
        "chunks_created": doc.get("chunks_created", 0),
        "qdrant_collection": doc.get("qdrant_collection"),
        "created_at": doc.get("created_at"),
    }


async def create_rag_document(
    user_id: str,
    filename: str,
    original_filename: str,
    chunks_created: int,
    qdrant_collection: str,
):
    document = {
        "user_id": user_id,
        "filename": filename,
        "original_filename": original_filename,
        "chunks_created": chunks_created,
        "qdrant_collection": qdrant_collection,
        "created_at": datetime.utcnow(),
    }

    result = await rag_documents_collection.insert_one(document)
    document["_id"] = result.inserted_id

    return serialize_rag_document(document)


async def get_user_rag_documents(user_id: str):
    cursor = rag_documents_collection.find({"user_id": user_id}).sort("created_at", -1)
    documents = await cursor.to_list(length=100)

    return [serialize_rag_document(doc) for doc in documents]


async def get_rag_document_by_id(document_id: str, user_id: str):
    if not ObjectId.is_valid(document_id):
        raise HTTPException(status_code=400, detail="Invalid document ID")

    document = await rag_documents_collection.find_one(
        {
            "_id": ObjectId(document_id),
            "user_id": user_id,
        }
    )

    if not document:
        raise HTTPException(status_code=404, detail="RAG document not found")

    return document


async def rename_rag_document(document_id: str, user_id: str, new_filename: str):
    document = await get_rag_document_by_id(document_id, user_id)

    await rag_documents_collection.update_one(
        {"_id": document["_id"]},
        {
            "$set": {
                "filename": new_filename,
                "updated_at": datetime.utcnow(),
            }
        },
    )

    updated_document = await rag_documents_collection.find_one({"_id": document["_id"]})
    return serialize_rag_document(updated_document)


async def delete_rag_document_metadata(document_id: str, user_id: str):
    document = await get_rag_document_by_id(document_id, user_id)

    await rag_documents_collection.delete_one({"_id": document["_id"]})

    return {
        "success": True,
        "message": "RAG PDF deleted successfully",
        "document_id": document_id,
    }