import pytest
from app.ai_config import (
    safe_extract_json,
    get_primary_model,
    get_fallback_model,
    DEFAULT_PRIMARY_MODEL,
    DEFAULT_FALLBACK_MODEL
)
from app.rag.chunker import chunk_text
from app.rag.embeddings import _deterministic_embedding, _normalize_vector
from app.rag.vector_store import ping_vector_store


def test_safe_extract_json_various_formats():
    # 1. Clean JSON
    assert safe_extract_json('{"key": "value"}') == {"key": "value"}

    # 2. Markdown fenced JSON
    markdown_json = """Here is the evaluated result:
```json
{
  "ai_score": 8,
  "feedback": "Strong explanation."
}
```
Good luck!"""
    extracted = safe_extract_json(markdown_json)
    assert extracted["ai_score"] == 8
    assert extracted["feedback"] == "Strong explanation."

    # 3. Smart quotes and minor escapes
    smart_quotes_json = '{\n  “score”: 9,\n  “note”: “Well done”\n}'
    extracted_sq = safe_extract_json(smart_quotes_json)
    assert extracted_sq["score"] == 9
    assert extracted_sq["note"] == "Well done"

    # 4. JSON Array
    array_json = '[{"question_index": 0, "difficulty": "easy"}]'
    assert safe_extract_json(array_json)[0]["difficulty"] == "easy"


def test_ai_model_resolution():
    primary = get_primary_model()
    fallback = get_fallback_model()
    assert primary != ""
    assert fallback != ""
    assert primary != fallback  # Primary and fallback must be distinct for failover to work
    assert "compound-mini" not in primary  # Deprecated model must be mapped out


def test_rag_chunking():
    # Text longer than chunk_size (800 chars)
    long_text = "Machine learning is a field of study in artificial intelligence. " * 30
    chunks = chunk_text(long_text, chunk_size=800, overlap=150)
    assert len(chunks) > 1
    assert all(len(c) > 0 for c in chunks)


def test_deterministic_embedding_dimension_and_norm():
    vec = _deterministic_embedding("Explain decision trees and information gain.", dim=384)
    assert len(vec) == 384
    norm = sum(x * x for x in vec) ** 0.5
    assert abs(norm - 1.0) < 1e-4  # L2 normalized


def test_vector_store_health_ping():
    health = ping_vector_store()
    assert "mode" in health
    assert "connectivity" in health
    assert "collection_exists" in health
    assert health["connectivity"] in ["connected", "fallback_active (remote unavailable, using local embedded)"]
