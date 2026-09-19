"""Direct multi-agent analysis endpoint."""

from backend.app.api.v1.complaints import create_and_analyze_complaint
from backend.app.database.session import get_db
from backend.app.schemas.complaint import ComplaintCreate
from backend.app.schemas.decision import DecisionReportResponse
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(tags=["Analysis Engine"])


@router.post("/analyze", response_model=DecisionReportResponse)
async def analyze_complaint_direct(
    payload: ComplaintCreate,
    db: AsyncSession = Depends(get_db),
) -> DecisionReportResponse:
    """Analyze a maintenance complaint with the full multi-agent pipeline and return the complete decision report."""
    return await create_and_analyze_complaint(payload, db)
