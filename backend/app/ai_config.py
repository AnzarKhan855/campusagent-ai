import os
import re
import json
import logging
from typing import Any, List, Dict, Optional
from dotenv import load_dotenv
from fastapi import HTTPException, status

load_dotenv()

logger = logging.getLogger("campusagent.ai")

try:
    from groq import AsyncGroq, Groq
except ImportError:
    AsyncGroq = None
    Groq = None

# Centralized Model Configuration
DEFAULT_PRIMARY_MODEL = "groq/compound-mini"
DEFAULT_FALLBACK_MODEL = "qwen/qwen3.8-27b"


def get_groq_api_key() -> str:
    key = os.getenv("GROQ_API_KEY", "").strip()
    if not key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI service is not configured: GROQ_API_KEY is missing."
        )
    return key

def get_primary_model() -> str:
    configured = os.getenv("GROQ_MODEL", "").strip()
    # If legacy/deprecated llama-3.1-8b-instant was left in environment, override with active model
    if not configured or "llama-3.1-8b-instant" in configured:
        return DEFAULT_PRIMARY_MODEL
    return configured

def get_fallback_model() -> str:
    configured = os.getenv("GROQ_FALLBACK_MODEL", "").strip()
    if not configured or "llama-3.1-8b-instant" in configured:
        return DEFAULT_FALLBACK_MODEL
    return configured

def get_async_groq_client() -> Any:
    if AsyncGroq is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Groq SDK is not installed in the backend environment."
        )
    return AsyncGroq(api_key=get_groq_api_key())

def get_sync_groq_client() -> Any:
    if Groq is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Groq SDK is not installed in the backend environment."
        )
    return Groq(api_key=get_groq_api_key())

async def generate_chat_completion(
    messages: List[Dict[str, str]],
    model: Optional[str] = None,
    temperature: float = 0.2,
    max_tokens: int = 1000,
    timeout: float = 35.0
) -> str:
    client = get_async_groq_client()
    primary = model or get_primary_model()
    fallback = get_fallback_model()

    # Attempt with primary model
    try:
        completion = await client.chat.completions.create(
            model=primary,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
            timeout=timeout
        )
        content = completion.choices[0].message.content or ""
        if content.strip():
            return content.strip()
    except Exception as primary_error:
        logger.warning(f"Primary Groq model ({primary}) failed: {primary_error}. Attempting fallback ({fallback}).")
        
        # If fallback is different, attempt fallback
        if fallback != primary:
            try:
                completion = await client.chat.completions.create(
                    model=fallback,
                    messages=messages,
                    temperature=temperature,
                    max_tokens=max_tokens,
                    timeout=timeout
                )
                content = completion.choices[0].message.content or ""
                if content.strip():
                    return content.strip()
            except Exception as fallback_error:
                logger.error(f"Fallback Groq model ({fallback}) also failed: {fallback_error}")
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail=f"AI service error: Primary model failed ({str(primary_error)}) and fallback failed ({str(fallback_error)})."
                )
        
        # Re-raise descriptive error if no fallback or fallback identical
        error_msg = str(primary_error)
        if "rate_limit" in error_msg.lower() or "429" in error_msg:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="AI service rate limit reached. Please try again in a few moments."
            )
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"AI service provider error: {error_msg}"
        )

    raise HTTPException(
        status_code=status.HTTP_502_BAD_GATEWAY,
        detail="AI service returned an empty response."
    )

def safe_extract_json(text: str) -> Any:
    """
    Robustly extracts and parses JSON from raw LLM output,
    handling markdown blocks, smart quotes, leading commentary, and minor escapes.
    """
    if not text or not text.strip():
        raise ValueError("AI response was empty.")

    cleaned = text.strip()
    # Strip markdown code fences
    cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned, flags=re.MULTILINE)
    cleaned = re.sub(r"\s*```$", "", cleaned, flags=re.MULTILINE)
    cleaned = cleaned.replace("“", '"').replace("”", '"').replace("‘", "'").replace("’", "'").strip()

    # Try direct parse
    try:
        return json.loads(cleaned)
    except Exception:
        pass

    # Find outermost object { ... }
    obj_match = re.search(r"(\{.*\})", cleaned, flags=re.DOTALL)
    if obj_match:
        candidate = obj_match.group(1)
        try:
            return json.loads(candidate)
        except Exception:
            # Try cleaning stray unescaped control chars
            repaired = re.sub(r'\\(?!["\\/bfnrtu])', "", candidate)
            try:
                return json.loads(repaired)
            except Exception:
                pass

    # Find outermost array [ ... ]
    arr_match = re.search(r"(\[.*\])", cleaned, flags=re.DOTALL)
    if arr_match:
        candidate = arr_match.group(1)
        try:
            return json.loads(candidate)
        except Exception:
            repaired = re.sub(r'\\(?!["\\/bfnrtu])', "", candidate)
            try:
                return json.loads(repaired)
            except Exception:
                pass

    raise ValueError(f"Could not parse valid JSON from AI response: {cleaned[:150]}...")
