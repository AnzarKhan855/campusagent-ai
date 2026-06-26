from qdrant_client import QdrantClient
from qdrant_client.models import (
    Distance,
    VectorParams,
    PointStruct,
    Filter,
    FieldCondition,
    MatchValue,
)
from typing import List, Optional
import uuid


QDRANT_PATH = "qdrant_storage"
COLLECTION_NAME = "campusagent_rag"

client = QdrantClient(path=QDRANT_PATH)


def ensure_collection(vector_size: int = 384):
    collections = client.get_collections().collections
    collection_names = [collection.name for collection in collections]

    if COLLECTION_NAME not in collection_names:
        client.create_collection(
            collection_name=COLLECTION_NAME,
            vectors_config=VectorParams(
                size=vector_size,
                distance=Distance.COSINE,
            ),
        )


def add_chunks_to_qdrant(
    chunks: List[str],
    embeddings: List[List[float]],
    user_id: str,
    document_id: str,
    filename: str,
):
    ensure_collection()

    points = []

    for index, chunk in enumerate(chunks):
        point_id = str(uuid.uuid4())

        points.append(
            PointStruct(
                id=point_id,
                vector=embeddings[index],
                payload={
                    "user_id": user_id,
                    "document_id": document_id,
                    "filename": filename,
                    "chunk_number": index + 1,
                    "text": chunk,
                },
            )
        )

    client.upsert(
        collection_name=COLLECTION_NAME,
        points=points,
    )

    return len(points)


def search_similar_chunks(
    query_embedding: List[float],
    user_id: str,
    document_id: Optional[str] = None,
    limit: int = 5,
):
    must_conditions = [
        FieldCondition(
            key="user_id",
            match=MatchValue(value=user_id),
        )
    ]

    if document_id:
        must_conditions.append(
            FieldCondition(
                key="document_id",
                match=MatchValue(value=document_id),
            )
        )

    search_filter = Filter(must=must_conditions)

    results = client.query_points(
        collection_name=COLLECTION_NAME,
        query=query_embedding,
        query_filter=search_filter,
        limit=limit,
    )

    return results.points


def delete_document_vectors(user_id: str, document_id: str):
    delete_filter = Filter(
        must=[
            FieldCondition(
                key="user_id",
                match=MatchValue(value=user_id),
            ),
            FieldCondition(
                key="document_id",
                match=MatchValue(value=document_id),
            ),
        ]
    )

    client.delete(
        collection_name=COLLECTION_NAME,
        points_selector=delete_filter,
    )

    return True