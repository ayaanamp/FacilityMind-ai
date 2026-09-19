"""Agent 4: Recommendation Agent."""

import time
from typing import Any

from backend.app.agents.llm import llm_client
from backend.app.agents.state import AgentState
from backend.app.schemas.agent import RecommendationOutput


def _deterministic_recommendation(state: AgentState) -> RecommendationOutput:
    """Fallback recommendation engine based on historical case statistics and rules."""
    similar_cases = state.get("similar_cases", [])
    analysis = state.get("analysis")
    diagnosis = state.get("diagnosis")

    top_case = similar_cases[0] if similar_cases else {}
    action = top_case.get(
        "recommended_fix", "Conduct on-site visual and electrical continuity inspection."
    )
    technician = top_case.get("technician_type", "General Facility Technician")
    urgency = analysis.severity if analysis else top_case.get("urgency", "Medium")

    # Compute cost range from similar cases
    costs = [c.get("estimated_cost", 1500) for c in similar_cases if c.get("estimated_cost")]
    if costs:
        avg_cost = sum(costs) // len(costs)
        cost_min = max(500, int(avg_cost * 0.8 // 50 * 50))
        cost_max = int(avg_cost * 1.25 // 50 * 50)
    else:
        cost_min, cost_max = 1200, 2800

    # Compute duration
    durations = [c.get("repair_time", 1.5) for c in similar_cases if c.get("repair_time")]
    repair_time = round(sum(durations) / len(durations), 1) if durations else 1.5

    repair_steps = [
        "1. Isolate equipment from main power supply and follow Lockout/Tagout (LOTO) safety protocol.",
        f"2. Inspect primary suspect component: {diagnosis.primary_cause if diagnosis else 'Fault area'}.",
        f"3. Execute prescribed maintenance: {action}.",
        "4. Perform functional load test and measure operating parameters against baseline thresholds.",
        "5. Log repair details and technician sign-off into campus maintenance log.",
    ]

    tools = [
        "Digital Multimeter",
        "Standard Insulated Toolset",
        "Infrared Thermometer",
        "Safety PPE Kit",
    ]
    parts = ["Replacement gaskets / seals", "Consumable cleaner / lubricant"]

    return RecommendationOutput(
        action=action,
        repair_steps=repair_steps,
        estimated_cost_min=cost_min,
        estimated_cost_max=cost_max,
        repair_time_hours=repair_time,
        urgency=urgency,
        technician_required=technician,
        required_tools=tools,
        replacement_parts=parts,
    )


async def run_recommendation_agent(state: AgentState) -> dict[str, Any]:
    """Execute Agent 4: Recommendation Agent."""
    start_time = time.time()
    raw_complaint = state.get("raw_complaint", "")
    analysis = state.get("analysis")
    similar_cases = state.get("similar_cases", [])
    diagnosis = state.get("diagnosis")

    # Format costs and fixes context
    historical_fixes = "\n".join(
        [
            f"- Case #{c['case_id']}: Fix: {c['recommended_fix']} | Cost: ₹{c['estimated_cost']} | Time: {c['repair_time']}h | Tech: {c['technician_type']}"
            for c in similar_cases[:5]
        ]
    )

    prompt = f"""You are the Recommendation Agent of FacilityMind AI.
Generate a structured, actionable maintenance prescription based on:

COMPLAINT: "{raw_complaint}"
DIAGNOSIS: {diagnosis.primary_cause if diagnosis else "Component fault"}
LOCATION: {analysis.location if analysis else "Campus Facility"}
SEVERITY: {analysis.severity if analysis else "Medium"}

HISTORICAL RESOLUTIONS & COSTS:
{historical_fixes}

Produce a JSON object with:
{{
  "action": "clear, authoritative single-sentence repair prescription",
  "repair_steps": [
    "1. Safety and power isolation step",
    "2. Component inspection step",
    "3. Corrective repair / replacement step",
    "4. Verification and functional test step",
    "5. Sign-off and logging step"
  ],
  "estimated_cost_min": 1500,
  "estimated_cost_max": 3000,
  "repair_time_hours": 1.5,
  "urgency": "Low | Medium | High | Critical",
  "technician_required": "Specialist trade title (e.g. HVAC Specialist, Electrician)",
  "required_tools": ["Tool 1", "Tool 2", "Tool 3"],
  "replacement_parts": ["Part 1", "Part 2"]
}}"""

    rec_data = await llm_client.generate_json(
        prompt,
        system_instruction="You prescribe concrete engineering fixes for facility infrastructure.",
    )

    if rec_data and "action" in rec_data and "estimated_cost_min" in rec_data:
        recommendation = RecommendationOutput(
            action=rec_data.get("action", "Inspect and service component"),
            repair_steps=rec_data.get("repair_steps", []),
            estimated_cost_min=int(rec_data.get("estimated_cost_min", 1200)),
            estimated_cost_max=int(rec_data.get("estimated_cost_max", 2800)),
            repair_time_hours=float(rec_data.get("repair_time_hours", 1.5)),
            urgency=rec_data.get("urgency", analysis.severity if analysis else "Medium"),
            technician_required=rec_data.get("technician_required", "Facility Technician"),
            required_tools=rec_data.get("required_tools", ["Multimeter", "Toolkit"]),
            replacement_parts=rec_data.get("replacement_parts", []),
        )
    else:
        recommendation = _deterministic_recommendation(state)

    exec_time = int((time.time() - start_time) * 1000)
    summary = f"Prescribed: {recommendation.action} [₹{recommendation.estimated_cost_min}-₹{recommendation.estimated_cost_max}, {recommendation.repair_time_hours}h]"

    agent_run = {
        "agent_name": "Recommendation Agent",
        "status": "Completed",
        "execution_time_ms": max(exec_time, 20),
        "output_summary": summary,
    }

    return {
        "recommendation": recommendation,
        "agent_runs": [agent_run],
    }
