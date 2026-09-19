"""Similar case semantic search endpoint."""

from backend.app.rag.retriever import retriever
from backend.app.schemas.decision import SimilarCaseItem
from fastapi import APIRouter, Query

router = APIRouter(prefix="/cases", tags=["Similar Cases Explorer"])


@router.get("/similar", response_model=list[SimilarCaseItem])
async def search_similar_cases(
    q: str = Query(
        ..., min_length=2, description="Natural language search query or complaint symptoms"
    ),
    equipment_type: str | None = Query(None, description="Filter by equipment category"),
    limit: int = Query(6, ge=1, le=20, description="Max cases to return"),
) -> list[SimilarCaseItem]:
    """Perform real-time semantic similarity search against past maintenance records."""
    matches = await retriever.retrieve_similar_cases(
        query=q,
        equipment_type=equipment_type,
        top_k=limit,
    )
    return [SimilarCaseItem(**m) for m in matches]
