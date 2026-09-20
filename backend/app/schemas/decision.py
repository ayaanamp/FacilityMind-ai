"""Comprehensive Decision Report and Similar Cases schemas."""

from datetime import datetime
from typing import Any

from backend.app.schemas.agent import (
    AgentRunItem,
    ComplaintAnalysisOutput,
    DiagnosisOutput,
    ExplanationOutput,
    RecommendationOutput,
)
from pydantic import BaseModel


class SimilarCaseItem(BaseModel):
    """Retrieved historical maintenance record with similarity metrics."""

    case_id: int
    similarity_score: float
    similarity_percentage: int
    equipment_type: str
    equipment_id: str
    location: str
    complaint: str
    symptoms: str
    diagnosis: str
    root_cause: str
    recommended_fix: str
    estimated_cost: int
    repair_time: float
    urgency: str
    technician_type: str
    date: str
    technician_notes: str


class DecisionReportResponse(BaseModel):
    """Unified enterprise decision-support report for facility management."""

    complaint_id: int
    tracking_code: str | None = None
    raw_complaint: str
    status: str
    created_at: datetime
    analysis: ComplaintAnalysisOutput
    similar_cases: list[SimilarCaseItem]
    diagnosis: DiagnosisOutput
    recommendation: RecommendationOutput
    explanation: ExplanationOutput
    agent_runs: list[AgentRunItem]
    is_fallback: bool = False
    human_verified: bool = False
    technician_feedback: dict[str, Any] | None = None
