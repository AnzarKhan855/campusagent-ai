from sentence_transformers import SentenceTransformer
from typing import List
import os

os.environ["HF_HUB_DISABLE_TELEMETRY"] = "1"

MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"

_model = None


def get_model():
    global _model

    if _model is None:
        print("Loading embedding model...")
        _model = SentenceTransformer(MODEL_NAME)
        print("Embedding model loaded successfully.")

    return _model


def get_embeddings(texts: List[str]) -> List[List[float]]:
    model = get_model()

    embeddings = model.encode(
        texts,
        convert_to_numpy=True,
        normalize_embeddings=True,
        show_progress_bar=False,
    )

    return embeddings.tolist()


def get_single_embedding(text: str) -> List[float]:
    model = get_model()

    embedding = model.encode(
        text,
        convert_to_numpy=True,
        normalize_embeddings=True,
        show_progress_bar=False,
    )

    return embedding.tolist()