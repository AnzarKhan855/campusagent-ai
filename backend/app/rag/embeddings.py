import os
from typing import List

import httpx

MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"
HF_API_URL = (
    "https://router.huggingface.co/hf-inference/models/"
    f"{MODEL_NAME}/pipeline/feature-extraction"
)


def _get_hf_token() -> str:
    token = os.getenv("HF_TOKEN", "").strip()

    if not token:
        raise RuntimeError(
            "HF_TOKEN is missing. Add it in Render Environment Variables."
        )

    return token


def _normalize_vector(vector: List[float]) -> List[float]:
    norm = sum(value * value for value in vector) ** 0.5

    if norm == 0:
        return vector

    return [value / norm for value in vector]


async def _request_embeddings(texts: List[str]) -> List[List[float]]:
    token = _get_hf_token()

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

    async with httpx.AsyncClient(timeout=60) as client:
        response = await client.post(HF_API_URL, headers=headers, json=payload)

    if response.status_code != 200:
        raise RuntimeError(
            f"Hugging Face embedding API error: {response.status_code} - {response.text}"
        )

    data = response.json()

    if not isinstance(data, list):
        raise RuntimeError(f"Unexpected embedding response: {data}")

    if len(data) == 0:
        return []

    embeddings: List[List[float]] = []

    for item in data:
        if (
            isinstance(item, list)
            and len(item) > 0
            and isinstance(item[0], list)
        ):
            # Sometimes HF returns token-level embeddings.
            # Mean-pool them into one sentence embedding.
            token_vectors = item
            dimension = len(token_vectors[0])
            pooled = [
                sum(token_vector[i] for token_vector in token_vectors)
                / len(token_vectors)
                for i in range(dimension)
            ]
            embeddings.append(_normalize_vector(pooled))

        elif isinstance(item, list):
            embeddings.append(_normalize_vector(item))

        else:
            raise RuntimeError(f"Invalid embedding item: {item}")

    return embeddings


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