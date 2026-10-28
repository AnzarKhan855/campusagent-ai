import logging
import os
import uuid
from typing import List, Optional
from qdrant_client import QdrantClient
from qdrant_client.models import (
    Distance,
    VectorParams,
    PointStruct,
    Filter,
    FieldCondition,
    MatchValue,
    PayloadSchemaType,
)

logger = logging.getLogger(__name__)

QDRANT_PATH = "qdrant_storage"
COLLECTION_NAME = "campusagent_rag"

qdrant_url = os.getenv("QDRANT_URL", "").strip()
qdrant_api_key = os.getenv("QDRANT_API_KEY", "").strip()

_remote_client = None
_embedded_client = None
_remote_failed = False


def get_embedded_client() -> QdrantClient:
    global _embedded_client
    if _embedded_client is None:
        _embedded_client = QdrantClient(path=QDRANT_PATH)
    return _embedded_client


def get_qdrant_client() -> QdrantClient:
    global _remote_client, _remote_failed
    if qdrant_url and not _remote_failed:
        if _remote_client is None:
            try:
                _remote_client = QdrantClient(
                    url=qdrant_url,
                    api_key=qdrant_api_key or None,
                    timeout=5.0,
                )
                _remote_client.get_collections()
            except Exception as err:
                logger.warning(
                    f"Remote Qdrant cluster unreachable ({err}). "
                    f"Falling back to local embedded storage ('{QDRANT_PATH}')."
                )
                _remote_failed = True
                _remote_client = None
        if _remote_client is not None:
            return _remote_client
    return get_embedded_client()


def ping_vector_store() -> dict:
    global _remote_failed
    client = get_qdrant_client()
    is_fallback = bool(qdrant_url and _remote_failed)
    mode = "local_embedded_fallback" if is_fallback else ("remote_qdrant_cloud" if qdrant_url else "local_embedded")
    try:
        collections = client.get_collections().collections
        collection_names = [c.name for c in collections]
        return {
            "mode": mode,
            "connectivity": "connected" if not is_fallback else "fallback_active (remote unavailable, using local embedded)",
            "collection_exists": COLLECTION_NAME in collection_names,
            "persistent": bool(qdrant_url and not is_fallback)
        }
    except Exception as error:
        logger.warning(f"Vector store health ping failed: {error}")
        return {
            "mode": mode,
            "connectivity": f"disconnected: {str(error)}",
            "collection_exists": False,
            "persistent": False
        }


def ensure_collection(vector_size: int = 384):
    global _remote_failed
    client = get_qdrant_client()
    try:
        collections = client.get_collections().collections
        collection_names = [collection.name for collection in collections]

        if COLLECTION_NAME not in collection_names:
            logger.info(f"Creating Qdrant collection '{COLLECTION_NAME}' (dim={vector_size}, distance=COSINE)")
            client.create_collection(
                collection_name=COLLECTION_NAME,
                vectors_config=VectorParams(
                    size=vector_size,
                    distance=Distance.COSINE,
                ),
            )

        # Ensure payload indexes exist for filtered queries and deletions
        try:
            col_info = client.get_collection(COLLECTION_NAME)
            payload_schema = getattr(col_info, "payload_schema", {}) or {}
            for field in ("user_id", "document_id"):
                if field not in payload_schema:
                    logger.info(f"Creating keyword payload index for '{field}' in '{COLLECTION_NAME}'")
                    client.create_payload_index(
                        collection_name=COLLECTION_NAME,
                        field_name=field,
                        field_schema=PayloadSchemaType.KEYWORD,
                    )
        except Exception as idx_err:
            logger.warning(f"Could not verify/create payload index: {idx_err}")
    except Exception as error:
        # If remote failed, fallback and retry once on embedded
        if qdrant_url and not _remote_failed:
            logger.warning(f"Failed to ensure collection on remote ({error}), retrying on local embedded storage")
            _remote_failed = True
            return ensure_collection(vector_size=vector_size)
        logger.error(f"Failed to ensure Qdrant collection '{COLLECTION_NAME}': {error}", exc_info=True)
        raise RuntimeError(f"Vector store collection initialization failed: {str(error)}") from error


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

    client = get_qdrant_client()
    try:
        client.upsert(
            collection_name=COLLECTION_NAME,
            points=points,
        )
    except Exception as error:
        if qdrant_url and not _remote_failed:
            logger.warning(f"Upsert failed on remote ({error}), retrying on local embedded storage")
            _remote_failed = True
            ensure_collection()
            get_embedded_client().upsert(
                collection_name=COLLECTION_NAME,
                points=points,
            )
            return len(points)
        logger.error(f"Failed to upsert points into collection '{COLLECTION_NAME}': {error}", exc_info=True)
        raise RuntimeError(f"Vector upsert failed: {str(error)}") from error

    return len(points)


def search_similar_chunks(
    query_embedding: List[float],
    user_id: str,
    document_id: Optional[str] = None,
    limit: int = 5,
):
    ensure_collection()
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

    client = get_qdrant_client()
    try:
        results = client.query_points(
            collection_name=COLLECTION_NAME,
            query=query_embedding,
            query_filter=search_filter,
            limit=limit,
        )
        return results.points
    except Exception as error:
        if qdrant_url and not _remote_failed:
            logger.warning(f"Vector search failed on remote ({error}), retrying on local embedded storage")
            _remote_failed = True
            ensure_collection()
            results = get_embedded_client().query_points(
                collection_name=COLLECTION_NAME,
                query=query_embedding,
                query_filter=search_filter,
                limit=limit,
            )
            return results.points
        logger.error(f"Qdrant search_similar_chunks failed: {error}", exc_info=True)
        raise RuntimeError(f"Vector search failed: {str(error)}") from error


def delete_document_vectors(user_id: str, document_id: str):
    ensure_collection()
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

    client = get_qdrant_client()
    try:
        client.delete(
            collection_name=COLLECTION_NAME,
            points_selector=delete_filter,
        )
    except Exception as error:
        if qdrant_url and not _remote_failed:
            logger.warning(f"Vector delete failed on remote ({error}), retrying on local embedded storage")
            _remote_failed = True
            ensure_collection()
            get_embedded_client().delete(
                collection_name=COLLECTION_NAME,
                points_selector=delete_filter,
            )
            return True
        logger.error(f"Failed to delete document vectors from Qdrant: {error}", exc_info=True)
        raise RuntimeError(f"Failed to delete document vectors: {str(error)}") from error

    return True