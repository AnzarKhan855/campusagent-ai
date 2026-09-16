import hashlib
import math
import os
from typing import List, Optional

import httpx

MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"
HF_API_URL = (
    "https://router.huggingface.co/hf-inference/models/"
    f"{MODEL_NAME}/pipeline/feature-extraction"
)

_local_st_model = None

def _get_local_st_model():
    global _local_st_model
    if _local_st_model is None:
        try:
            from sentence_transformers import SentenceTransformer
            _local_st_model = SentenceTransformer("all-MiniLM-L6-v2")
        except Exception:
            _local_st_model = False
    return _local_st_model if _local_st_model is not False else None


def _get_hf_token() -> Optional[str]:
    token = os.getenv("HF_TOKEN", "").strip()
    return token if token else None


def _deterministic_embedding(text: str, dim: int = 384) -> List[float]:
    vector = [0.0] * dim
    words = text.lower().split()
    if not words:
        words = ["empty"]
    for w in words:
        h = int(hashlib.md5(w.encode("utf-8")).hexdigest(), 16)
        idx = h % dim
        vector[idx] += 1.0
    norm = math.sqrt(sum(x * x for x in vector))
    if norm > 0:
        vector = [x / norm for x in vector]
    return vector


def _normalize_vector(vector: List[float]) -> List[float]:
    norm = sum(value * value for value in vector) ** 0.5

    if norm == 0:
        return vector

    return [value / norm for value in vector]


async def _request_embeddings(texts: List[str]) -> List[List[float]]:
    token = _get_hf_token()

    if token:
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        }

        payload = {
            "inputs": texts,
            "options": {
                "wait_for_model": True,
            },
        }

        try:
            async with httpx.AsyncClient(timeout=15) as client:
                response = await client.post(HF_API_URL, headers=headers, json=payload)

            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list) and len(data) > 0:
                    embeddings: List[List[float]] = []
                    for item in data:
                        if isinstance(item, list) and len(item) > 0 and isinstance(item[0], list):
                            token_vectors = item
                            dim = len(token_vectors[0])
                            pooled = [
                                sum(tv[i] for tv in token_vectors) / len(token_vectors)
                                for i in range(dim)
                            ]
                            embeddings.append(_normalize_vector(pooled))
                        elif isinstance(item, list):
                            embeddings.append(_normalize_vector(item))
                    if len(embeddings) == len(texts):
                        return embeddings
        except Exception:
            pass

    # Fallback 1: Try local SentenceTransformer if installed
    st_model = _get_local_st_model()
    if st_model is not None:
        try:
            raw_embs = st_model.encode(texts, convert_to_numpy=True)
            return [emb.tolist() for emb in raw_embs]
        except Exception:
            pass

    # Fallback 2: Fast deterministic 384-dimensional normalized vector
    return [_deterministic_embedding(t, dim=384) for t in texts]


async def get_embeddings(texts: List[str]) -> List[List[float]]:
    clean_texts = [text.strip() for text in texts if text and text.strip()]

    if not clean_texts:
        return []

    return await _request_embeddings(clean_texts)


async def get_single_embedding(text: str) -> List[float]:
    embeddings = await get_embeddings([text])

    if not embeddings:
        raise RuntimeError("Could not create embedding for empty text.")

    return embeddings[0]