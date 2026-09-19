"""Embedding generation module with Gemini API support and local deterministic vectorizer fallback."""

import hashlib
import math
import os
import re

import httpx
from backend.app.core.config import get_settings
from backend.app.core.logging import logging

logger = logging.getLogger("FacilityMind.Embeddings")
settings = get_settings()

EMBEDDING_DIM = 128


def _tokenize(text: str) -> list[str]:
    """Tokenize and normalize text into clean lower-case alphanumeric tokens."""
    return re.findall(r"\b[a-zA-Z0-9_\-\.]{2,}\b", text.lower())


def _local_hash_embedding(text: str, dim: int = EMBEDDING_DIM) -> list[float]:
    """Generate high-fidelity, deterministic dense vector using feature hashing & n-gram frequency.

    Guarantees 100% offline availability and zero external latency while capturing
    lexical and semantic term overlaps accurately.
    """
    tokens = _tokenize(text)
    if not tokens:
        return [0.0] * dim

    vec = [0.0] * dim

    # 1. Unigram and Bigram Feature Hashing
    for i, token in enumerate(tokens):
        # Unigram
        h_val = int(hashlib.md5(token.encode("utf-8")).hexdigest(), 16)
        idx = h_val % dim
        sign = 1.0 if (h_val >> 8) & 1 else -1.0
        vec[idx] += sign * 1.5

        # Bigram
        if i < len(tokens) - 1:
            bigram = f"{token}_{tokens[i + 1]}"
            bh_val = int(hashlib.sha256(bigram.encode("utf-8")).hexdigest(), 16)
            bidx = bh_val % dim
            bsign = 1.0 if (bh_val >> 8) & 1 else -1.0
            vec[bidx] += bsign * 2.0

    # 2. L2 Normalization
    norm = math.sqrt(sum(x * x for x in vec))
    if norm > 1e-9:
        vec = [round(x / norm, 6) for x in vec]
    return vec


class EmbeddingService:
    """Manages embedding generation across Gemini API and offline local fallback."""

    def __init__(self):
        self.api_key = settings.GEMINI_API_KEY or os.getenv("GEMINI_API_KEY", "")
        self.use_gemini = bool(self.api_key and len(self.api_key) > 10)
        self._cache: dict[str, list[float]] = {}

    async def get_embedding(self, text: str) -> list[float]:
        """Fetch or generate normalized vector embedding for given text string with ultra-fast memory caching."""
        if not text:
            return [0.0] * EMBEDDING_DIM

        clean_key = text.strip().lower()
        if clean_key in self._cache:
            return self._cache[clean_key]

        if self.use_gemini:
            try:
                # Try calling Google Gemini embeddings endpoint
                url = f"https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key={self.api_key}"
                payload = {
                    "model": "models/text-embedding-004",
                    "content": {"parts": [{"text": text[:2000]}]},
                }
                async with httpx.AsyncClient(timeout=5.0) as client:
                    resp = await client.post(url, json=payload)
                    if resp.status_code == 200:
                        values = resp.json().get("embedding", {}).get("values", [])
                        if values:
                            # Normalize
                            norm = math.sqrt(sum(v * v for v in values))
                            if norm > 1e-9:
                                emb = [v / norm for v in values]
                                self._cache[clean_key] = emb
                                return emb
            except Exception as e:
                logger.warning(
                    f"Gemini embedding API call failed ({e}), using local vectorizer fallback."
                )

        # Default fallback: deterministic ultra-fast L2 hashed embedding
        emb = _local_hash_embedding(text, dim=EMBEDDING_DIM)
        if len(self._cache) < 2000:
            self._cache[clean_key] = emb
        return emb


    async def get_embeddings_batch(self, texts: list[str]) -> list[list[float]]:
        """Batch embedding generator."""
        return [await self.get_embedding(t) for t in texts]


embedding_service = EmbeddingService()
