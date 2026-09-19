"""Agent 2: Historical Retrieval Agent."""

import time
from typing import Any

from backend.app.agents.state import AgentState
from backend.app.rag.retriever import retriever


async def run_retrieval_agent(state: AgentState) -> dict[str, Any]:
    """Execute Agent 2: Historical Retrieval Agent."""
    start_time = time.time()
    analysis = state.get("analysis")
    raw_complaint = state.get("raw_complaint", "")

    query = raw_complaint
    eq_type = None
    if analysis:
        eq_type = analysis.equipment_type
        query = f"{analysis.symptoms} {' '.join(analysis.keywords)}"

    # Retrieve top 6 matching historical cases from vector store
    cases = await retriever.retrieve_similar_cases(
        query=query,
        equipment_type=eq_type,
        top_k=6,
    )

    exec_time = int((time.time() - start_time) * 1000)
    top_score = cases[0]["similarity_percentage"] if cases else 0
    summary = f"Retrieved {len(cases)} relevant historical cases from knowledge base (Top match: {top_score}% similarity)"

    agent_run = {
        "agent_name": "Historical Retrieval Agent",
        "status": "Completed",
        "execution_time_ms": max(exec_time, 15),
        "output_summary": summary,
    }

    return {
        "similar_cases": cases,
        "agent_runs": [agent_run],
    }
