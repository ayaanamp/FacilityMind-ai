"""In-Memory and file-persisted Vector Store with Cosine Similarity search."""

import json
from pathlib import Path
from typing import Any

from backend.app.core.logging import logging

logger = logging.getLogger("FacilityMind.VectorStore")


def _cosine_similarity(v1: list[float], v2: list[float]) -> float:
    """Ultra-fast dot-product similarity for pre-normalized float vectors."""
    if not v1 or not v2 or len(v1) != len(v2):
        return 0.0
    dot_product = sum(a * b for a, b in zip(v1, v2, strict=False))
    return max(0.0, min(1.0, (dot_product + 1.0) / 2.0))



PROJECT_ROOT = Path(__file__).resolve().parents[3]
DEFAULT_VECTOR_INDEX_PATH = PROJECT_ROOT / "data" / "vector_index.json"


class VectorStore:
    """Vector database index holding maintenance cases for fast similarity retrieval."""

    def __init__(self, persistence_path: Path | None = None):
        self.persistence_path = persistence_path or DEFAULT_VECTOR_INDEX_PATH
        self.documents: list[dict[str, Any]] = []
        if self.persistence_path.exists():
            self.load()

    def count(self) -> int:
        """Return number of indexed documents."""
        return len(self.documents)

    def add_document(
        self,
        doc_id: int,
        text: str,
        embedding: list[float],
        metadata: dict[str, Any],
    ) -> None:
        """Add or update an indexed case."""
        # Remove existing if duplicate
        self.documents = [d for d in self.documents if d["id"] != doc_id]
        self.documents.append(
            {
                "id": doc_id,
                "text": text,
                "embedding": embedding,
                "metadata": metadata,
            }
        )

    def search(
        self,
        query_embedding: list[float],
        top_k: int = 6,
        equipment_filter: str | None = None,
        query_text: str | None = None,
    ) -> list[dict[str, Any]]:
        """Perform hybrid semantic and lexical similarity search returning top-k scored matches."""
        if not self.documents:
            return []

        # Extract search tokens
        q_tokens = set()
        if query_text:
            import re
            stop_words = {"the", "and", "for", "with", "from", "that", "this", "are", "was", "has", "not", "have", "had"}
            q_tokens = {w for w in re.findall(r"\b[a-zA-Z0-9]{3,}\b", query_text.lower()) if w not in stop_words}

        scored_results = []
        for doc in self.documents:
            dense_score = _cosine_similarity(query_embedding, doc["embedding"])
            meta = doc["metadata"]
            doc_text_lower = (doc["text"] + " " + meta.get("equipment_type", "") + " " + meta.get("symptoms", "")).lower()

            # Lexical token match ratio
            lexical_score = 0.0
            if q_tokens:
                matches = sum(1 for t in q_tokens if t in doc_text_lower)
                lexical_score = matches / len(q_tokens)

            # Combined hybrid score (60% Dense Semantic + 40% Lexical Keyword)
            combined_score = 0.60 * dense_score + 0.40 * lexical_score

            # Category boost if relevant
            eq_type_doc = meta.get("equipment_type", "").lower()
            if equipment_filter and equipment_filter.lower() not in ["custom hardware / other", "other", "general facility", ""]:
                if equipment_filter.lower() in eq_type_doc or eq_type_doc in equipment_filter.lower():
                    combined_score = min(0.99, combined_score * 1.30 + 0.25)
            elif q_tokens and any(t in eq_type_doc for t in q_tokens):
                # If query contains category keywords, boost matching category
                combined_score = min(0.99, combined_score * 1.25 + 0.20)

            scored_results.append(
                {
                    "id": doc["id"],
                    "similarity_score": round(combined_score, 4),
                    "similarity_percentage": int(round(combined_score * 100)),
                    "text": doc["text"],
                    "metadata": meta,
                }
            )

        # Sort descending by similarity score
        scored_results.sort(key=lambda x: x["similarity_score"], reverse=True)
        return scored_results[:top_k]


    def save(self) -> None:
        """Persist index to disk."""
        try:
            self.persistence_path.parent.mkdir(parents=True, exist_ok=True)
            with open(self.persistence_path, "w", encoding="utf-8") as f:
                json.dump(self.documents, f, ensure_ascii=False, indent=2)
            logger.info(f"Saved {len(self.documents)} vector documents to {self.persistence_path}")
        except Exception as e:
            logger.warning(f"Could not save vector index: {e}")

    def load(self) -> bool:
        """Load vector index from disk if exists."""
        if self.persistence_path.exists():
            try:
                with open(self.persistence_path, encoding="utf-8") as f:
                    self.documents = json.load(f)
                logger.info(
                    f"Loaded {len(self.documents)} vector documents from {self.persistence_path}"
                )
                return True
            except Exception as e:
                logger.warning(f"Could not load vector index: {e}")
        return False

    def clear(self) -> None:
        """Clear all indexed documents and persist empty state."""
        self.documents = []
        self.save()
        logger.info(f"Vector store cleared at {self.persistence_path}")


vector_store = VectorStore()
