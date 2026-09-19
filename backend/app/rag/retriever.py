"""Historical case retrieval interface for RAG pipeline."""

from typing import Any

from backend.app.rag.embeddings import embedding_service
from backend.app.rag.vector_store import vector_store


class HistoricalCaseRetriever:
    """Retrieves top similar past maintenance cases based on semantic and keyword signals."""

    async def retrieve_similar_cases(
        self,
        query: str,
        equipment_type: str | None = None,
        top_k: int = 6,
    ) -> list[dict[str, Any]]:
        """Perform semantic retrieval against the indexed maintenance database."""
        # 1. Generate query embedding
        query_text = f"{equipment_type or ''} {query}".strip()
        query_embedding = await embedding_service.get_embedding(query_text)

        # 2. Search vector store with hybrid semantic + lexical token matching
        matches = vector_store.search(
            query_embedding=query_embedding,
            top_k=top_k,
            equipment_filter=equipment_type,
            query_text=query_text,
        )


        formatted_cases = []
        for match in matches:
            meta = match["metadata"]
            formatted_cases.append(
                {
                    "case_id": match["id"],
                    "similarity_score": match["similarity_score"],
                    "similarity_percentage": match["similarity_percentage"],
                    "equipment_type": meta.get("equipment_type", "General Facility"),
                    "equipment_id": meta.get("equipment_id", "N/A"),
                    "location": meta.get("location", "Campus"),
                    "complaint": meta.get("complaint", ""),
                    "symptoms": meta.get("symptoms", ""),
                    "diagnosis": meta.get("diagnosis", ""),
                    "root_cause": meta.get("root_cause", ""),
                    "recommended_fix": meta.get("recommended_fix", ""),
                    "estimated_cost": meta.get("estimated_cost", 0),
                    "repair_time": meta.get("repair_time", 1.0),
                    "urgency": meta.get("urgency", "Medium"),
                    "technician_type": meta.get("technician_type", "Technician"),
                    "date": meta.get("date", ""),
                    "technician_notes": meta.get("technician_notes", ""),
                }
            )

        return formatted_cases


retriever = HistoricalCaseRetriever()
