"""State definition for FacilityMind multi-agent orchestration."""

from typing import Any, TypedDict

from backend.app.schemas.agent import (
    ComplaintAnalysisOutput,
    DiagnosisOutput,
    ExplanationOutput,
    RecommendationOutput,
)


class AgentState(TypedDict, total=False):
    """Shared state container passed between agents in the workflow graph."""

    raw_complaint: str
    complaint_id: int | None
    equipment_hint: str | None
    location_hint: str | None
    severity_hint: str | None

    # Agent step outputs
    analysis: ComplaintAnalysisOutput | None
    similar_cases: list[dict[str, Any]]
    diagnosis: DiagnosisOutput | None
    recommendation: RecommendationOutput | None
    explanation: ExplanationOutput | None

    # Telemetry and audits
    agent_runs: list[dict[str, Any]]
    is_fallback: bool
    errors: list[str]
