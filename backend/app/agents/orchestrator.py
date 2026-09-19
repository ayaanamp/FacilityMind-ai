"""LangGraph Multi-Agent Orchestrator for FacilityMind AI."""

from typing import Any

from backend.app.agents.analyzer_agent import run_analyzer_agent
from backend.app.agents.diagnosis_agent import run_diagnosis_agent
from backend.app.agents.explanation_agent import run_explanation_agent
from backend.app.agents.recommendation_agent import run_recommendation_agent
from backend.app.agents.retrieval_agent import run_retrieval_agent
from backend.app.agents.state import AgentState
from backend.app.agents.validator_agent import run_validator_agent
from backend.app.core.logging import logging
from langgraph.graph import END, StateGraph

logger = logging.getLogger("FacilityMind.Orchestrator")


async def node_analyzer(state: AgentState) -> dict[str, Any]:
    """Node 1: Complaint Analysis."""
    res = await run_analyzer_agent(state)
    runs = state.get("agent_runs", []) + res.get("agent_runs", [])
    return {"analysis": res["analysis"], "agent_runs": runs}


async def node_retrieval(state: AgentState) -> dict[str, Any]:
    """Node 2: Historical Case Retrieval."""
    res = await run_retrieval_agent(state)
    runs = state.get("agent_runs", []) + res.get("agent_runs", [])
    return {"similar_cases": res["similar_cases"], "agent_runs": runs}


async def node_diagnosis(state: AgentState) -> dict[str, Any]:
    """Node 3: Diagnosis Reasoning."""
    res = await run_diagnosis_agent(state)
    runs = state.get("agent_runs", []) + res.get("agent_runs", [])
    return {"diagnosis": res["diagnosis"], "agent_runs": runs}


async def node_recommendation(state: AgentState) -> dict[str, Any]:
    """Node 4: Recommendation Prescription."""
    res = await run_recommendation_agent(state)
    runs = state.get("agent_runs", []) + res.get("agent_runs", [])
    return {"recommendation": res["recommendation"], "agent_runs": runs}


async def node_explanation(state: AgentState) -> dict[str, Any]:
    """Node 5: Decision Explanation."""
    res = await run_explanation_agent(state)
    runs = state.get("agent_runs", []) + res.get("agent_runs", [])
    return {"explanation": res["explanation"], "agent_runs": runs}


async def node_validator(state: AgentState) -> dict[str, Any]:
    """Node 6: Validation & Guardrails."""
    res = await run_validator_agent(state)
    runs = state.get("agent_runs", []) + res.get("agent_runs", [])
    return {"errors": res.get("errors", []), "agent_runs": runs}


def build_workflow_graph() -> Any:
    """Construct and compile LangGraph StateGraph."""
    graph = StateGraph(AgentState)

    graph.add_node("analyzer", node_analyzer)
    graph.add_node("retrieval", node_retrieval)
    graph.add_node("diagnosis", node_diagnosis)
    graph.add_node("recommendation", node_recommendation)
    graph.add_node("explanation", node_explanation)
    graph.add_node("validator", node_validator)

    graph.set_entry_point("analyzer")
    graph.add_edge("analyzer", "retrieval")
    graph.add_edge("retrieval", "diagnosis")
    graph.add_edge("diagnosis", "recommendation")
    graph.add_edge("recommendation", "explanation")
    graph.add_edge("explanation", "validator")
    graph.add_edge("validator", END)

    return graph.compile()


compiled_app = build_workflow_graph()


class OrchestratorService:
    """Manages execution of multi-agent pipeline."""

    async def execute_pipeline(
        self,
        raw_complaint: str,
        complaint_id: int | None = None,
        equipment_hint: str | None = None,
        location_hint: str | None = None,
        severity_hint: str | None = None,
    ) -> AgentState:
        """Run the end-to-end multi-agent pipeline."""
        initial_state: AgentState = {
            "raw_complaint": raw_complaint,
            "complaint_id": complaint_id,
            "equipment_hint": equipment_hint,
            "location_hint": location_hint,
            "severity_hint": severity_hint,
            "agent_runs": [],
            "errors": [],
            "is_fallback": False,
        }

        try:
            result = await compiled_app.ainvoke(initial_state)
            return result
        except Exception as e:
            logger.error(f"LangGraph execution exception: {e}. Executing sequential fallback.")
            # Resilient sequential execution
            state = initial_state
            s1 = await node_analyzer(state)
            state.update(s1)
            s2 = await node_retrieval(state)
            state.update(s2)
            s3 = await node_diagnosis(state)
            state.update(s3)
            s4 = await node_recommendation(state)
            state.update(s4)
            s5 = await node_explanation(state)
            state.update(s5)
            s6 = await node_validator(state)
            state.update(s6)
            return state


orchestrator = OrchestratorService()
