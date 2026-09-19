"""Pydantic schemas for individual agent outputs and multi-agent workflow tracking."""

from pydantic import BaseModel, Field


class AgentRunItem(BaseModel):
    """Execution trace item for an individual agent."""

    agent_name: str
    status: str
    execution_time_ms: int
    output_summary: str


class ComplaintAnalysisOutput(BaseModel):
    """Structured extraction output from Agent 1 (Complaint Analysis Agent)."""

    equipment_type: str = Field(..., description="Standardized equipment category")
    equipment_id: str | None = Field(
        "N/A", description="Extracted or inferred equipment identifier"
    )
    location: str = Field(..., description="Extracted building, room, or lab location")
    symptoms: str = Field(..., description="Key failure symptoms identified in natural language")
    severity: str = Field("Medium", description="Low, Medium, High, or Critical")
    operational_impact: str = Field("", description="Impact on campus/facility operations")
    keywords: list[str] = Field(
        default_factory=list, description="Extracted domain keywords for retrieval"
    )


class DiagnosisOutput(BaseModel):
    """Structured diagnosis output from Agent 3 (Diagnosis Agent)."""

    primary_cause: str = Field(
        ..., description="Most probable root cause based on historical evidence"
    )
    possible_causes: list[str] = Field(
        default_factory=list, description="Ranked alternative possibilities"
    )
    confidence_level: str = Field(
        "Moderate Evidence", description="High Evidence, Moderate Evidence, or Limited Evidence"
    )
    supporting_cases: list[int] = Field(
        default_factory=list, description="IDs of historical cases backing this diagnosis"
    )
    reasoning_summary: str = Field(
        ..., description="Synthesis connecting symptoms to historical failure modes"
    )
    is_fallback: bool = Field(
        False, description="Whether generated via deterministic fallback rules"
    )


class RecommendationOutput(BaseModel):
    """Structured recommendation output from Agent 4 (Recommendation Agent)."""

    action: str = Field(..., description="Primary corrective maintenance action prescribed")
    repair_steps: list[str] = Field(
        default_factory=list, description="Sequential step-by-step repair instructions"
    )
    estimated_cost_min: int = Field(..., description="Minimum estimated repair cost in INR (₹)")
    estimated_cost_max: int = Field(..., description="Maximum estimated repair cost in INR (₹)")
    repair_time_hours: float = Field(..., description="Estimated technician duration in hours")
    urgency: str = Field("Medium", description="Low, Medium, High, or Critical")
    technician_required: str = Field(..., description="Required technician trade or certification")
    required_tools: list[str] = Field(
        default_factory=list, description="Tools and diagnostic instruments required"
    )
    replacement_parts: list[str] = Field(
        default_factory=list, description="Required spare parts or consumables"
    )


class ExplanationOutput(BaseModel):
    """Structured plain-language explanation output from Agent 5 (Explanation Agent)."""

    explanation_points: list[str] = Field(
        default_factory=list,
        description="Numbered, transparent explanation points outlining why this decision was reached",
    )
    full_text: str = Field(
        ..., description="Complete readable rationale narrative for facility managers"
    )
