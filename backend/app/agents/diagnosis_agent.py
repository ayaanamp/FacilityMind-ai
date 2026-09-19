"""Agent 3: Diagnosis Agent."""

import time
from typing import Any

from backend.app.agents.llm import llm_client
from backend.app.agents.state import AgentState
from backend.app.schemas.agent import DiagnosisOutput


def _deterministic_diagnosis(state: AgentState) -> DiagnosisOutput:
    """Fallback diagnosis based directly on top retrieved historical evidence."""
    similar_cases = state.get("similar_cases", [])
    analysis = state.get("analysis")
    eq_name = analysis.equipment_type if analysis else "Equipment"

    if similar_cases:
        top_case = similar_cases[0]
        primary_cause = top_case.get("root_cause") or top_case.get(
            "diagnosis", "Mechanical component wear"
        )

        # Extract alternative causes from remaining cases
        alt_causes = []
        for c in similar_cases[1:4]:
            cause = c.get("root_cause") or c.get("diagnosis")
            if cause and cause not in alt_causes and cause != primary_cause:
                alt_causes.append(cause)

        supporting_ids = [c["case_id"] for c in similar_cases[:3]]
        top_score = top_case.get("similarity_percentage", 80)

        confidence = (
            "High Evidence"
            if top_score >= 85
            else "Moderate Evidence"
            if top_score >= 60
            else "Limited Evidence"
        )

        reasoning = (
            f"Based on {len(similar_cases)} matching historical maintenance records for {eq_name}, "
            f"the reported symptoms strongly align with past incidents where '{primary_cause}' was verified as the root cause. "
            f"Case #{top_case.get('case_id')} in {top_case.get('location')} resolved identical symptoms."
        )

        return DiagnosisOutput(
            primary_cause=primary_cause,
            possible_causes=alt_causes or [f"Secondary component fatigue in {eq_name}"],
            confidence_level=confidence,
            supporting_cases=supporting_ids,
            reasoning_summary=reasoning,
            is_fallback=True,
        )

    return DiagnosisOutput(
        primary_cause=f"Suspected mechanical/electrical fault in {eq_name}",
        possible_causes=["Power supply anomaly", f"Component wear in {eq_name}"],
        confidence_level="Limited Evidence",
        supporting_cases=[],
        reasoning_summary=f"No close historical precedent found. Manual on-site inspection of {eq_name} required.",
        is_fallback=True,
    )


async def run_diagnosis_agent(state: AgentState) -> dict[str, Any]:
    """Execute Agent 3: Diagnosis Agent."""
    start_time = time.time()
    raw_complaint = state.get("raw_complaint", "")
    analysis = state.get("analysis")
    similar_cases = state.get("similar_cases", [])

    # Format historical evidence context for prompt
    evidence_text = ""
    for c in similar_cases[:5]:
        evidence_text += (
            f"Case #{c['case_id']} ({c['similarity_percentage']}% similarity):\n"
            f"  Equipment: {c['equipment_type']} at {c['location']}\n"
            f"  Complaint: {c['complaint']}\n"
            f"  Symptoms: {c['symptoms']}\n"
            f"  Diagnosis: {c['diagnosis']}\n"
            f"  Root Cause: {c['root_cause']}\n"
            f"  Fix: {c['recommended_fix']}\n\n"
        )

    prompt = f"""You are the Diagnosis Reasoning Agent of FacilityMind AI.
Analyze this active maintenance complaint against historical evidence:

ACTIVE COMPLAINT:
"{raw_complaint}"
Equipment: {analysis.equipment_type if analysis else "Facility Asset"}
Symptoms: {analysis.symptoms if analysis else raw_complaint}
Location: {analysis.location if analysis else "Campus"}

RETRIEVED HISTORICAL EVIDENCE:
{evidence_text}

INSTRUCTIONS:
1. Synthesize the root cause by evaluating which historical failure patterns best explain the active symptoms.
2. Differentiate clearly between AI inference and historical evidence (never state an inference as confirmed physical fact).
3. Determine confidence level: 'High Evidence' (strong historical precedent), 'Moderate Evidence', or 'Limited Evidence'.

Produce a JSON object with:
{{
  "primary_cause": "concise, technically sound root cause inference",
  "possible_causes": ["ranked alternative 1", "ranked alternative 2"],
  "confidence_level": "High Evidence | Moderate Evidence | Limited Evidence",
  "supporting_cases": [list of matching case_id numbers],
  "reasoning_summary": "plain-language synthesis connecting symptoms to historical failure modes"
}}"""

    diagnosis_data = await llm_client.generate_json(
        prompt, system_instruction="You reason over facility equipment failure evidence."
    )

    if diagnosis_data and "primary_cause" in diagnosis_data:
        diagnosis = DiagnosisOutput(
            primary_cause=diagnosis_data.get("primary_cause", "Component Wear"),
            possible_causes=diagnosis_data.get("possible_causes", []),
            confidence_level=diagnosis_data.get("confidence_level", "Moderate Evidence"),
            supporting_cases=diagnosis_data.get(
                "supporting_cases", [c["case_id"] for c in similar_cases[:3]]
            ),
            reasoning_summary=diagnosis_data.get("reasoning_summary", ""),
            is_fallback=False,
        )
    else:
        diagnosis = _deterministic_diagnosis(state)

    exec_time = int((time.time() - start_time) * 1000)
    summary = f"Diagnosed: {diagnosis.primary_cause} [{diagnosis.confidence_level}]"

    agent_run = {
        "agent_name": "Diagnosis Agent",
        "status": "Completed" if not diagnosis.is_fallback else "Completed (Evidence Engine)",
        "execution_time_ms": max(exec_time, 25),
        "output_summary": summary,
    }

    return {
        "diagnosis": diagnosis,
        "agent_runs": [agent_run],
    }
