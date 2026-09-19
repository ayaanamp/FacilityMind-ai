"""Agent 1: Complaint Analysis Agent."""

import re
import time
from typing import Any

from backend.app.agents.llm import llm_client
from backend.app.agents.state import AgentState
from backend.app.schemas.agent import ComplaintAnalysisOutput

# Known facility equipment categories
KNOWN_EQUIPMENT = [
    (
        "Air Conditioner",
        [
            "ac",
            "air conditioner",
            "air conditioning",
            "cooling",
            "chiller",
            "hvac",
            "split unit",
            "blower",
        ],
    ),
    ("Diesel Generator", ["generator", "dg", "genset", "diesel generator", "engine", "starter"]),
    ("Elevator", ["elevator", "lift", "lift car", "elevator door", "traction"]),
    ("Water Pump", ["water pump", "pump", "hydro-pneumatic", "suction pump", "booster pump"]),
    ("Classroom Projector", ["projector", "hdmi", "display", "screen", "lamp", "presentation"]),
    ("UPS System", ["ups", "battery backup", "inverter", "battery bank", "bypass"]),
    (
        "RO Water Purifier",
        ["ro", "water purifier", "drinking water", "tds", "water filter", "membrane"],
    ),
    (
        "Electrical Panel",
        ["electrical panel", "panel", "breaker", "mccb", "db", "distribution board", "busbar"],
    ),
    ("CCTV Camera", ["cctv", "camera", "video feed", "surveillance", "nvr"]),
    ("Network Switch", ["switch", "router", "wifi", "ethernet", "poe", "access point"]),
    (
        "Restroom / Washroom Plumbing",
        [
            "washroom",
            "toilet",
            "restroom",
            "urinal",
            "flush",
            "plumbing",
            "tap",
            "leak",
            "pipe",
            "drain",
            "faucet",
            "sewage",
            "basin",
            "commode",
            "flush tank",
            "water leakage",
        ],
    ),
    (
        "Lighting & Electrical",
        [
            "light",
            "tube light",
            "lamp",
            "bulb",
            "flicker",
            "switchboard",
            "socket",
            "wiring",
            "ceiling fan",
            "exhaust fan",
            "illumination",
        ],
    ),
    (
        "Laboratory Equipment",
        [
            "fume hood",
            "autoclave",
            "centrifuge",
            "microscope",
            "incubator",
            "shaker",
            "spectrophotometer",
            "lab freezer",
        ],
    ),
]


def _rule_based_extraction(
    raw_text: str, equipment_hint: str = None, location_hint: str = None, severity_hint: str = None
) -> ComplaintAnalysisOutput:
    """Deterministic entity extraction fallback."""
    text_lower = raw_text.lower()

    # Detect equipment accurately
    detected_equipment = None
    # 1. If explicit specific hint provided (and not generic 'other')
    if equipment_hint and equipment_hint.lower() not in ["custom hardware / other", "other", ""]:
        detected_equipment = equipment_hint

    # 2. Match text against known equipment keywords
    if not detected_equipment:
        for eq_name, keywords in KNOWN_EQUIPMENT:
            if any(k in text_lower for k in keywords):
                detected_equipment = eq_name
                break

    # 3. Fallback
    if not detected_equipment:
        if equipment_hint and equipment_hint.strip():
            detected_equipment = equipment_hint.strip()
        else:
            detected_equipment = "General Facility"


    # Detect equipment ID
    id_match = re.search(r"\b([A-Z]{2,4}[-_]?[0-9]{2,4})\b", raw_text, re.IGNORECASE)
    detected_id = id_match.group(1).upper() if id_match else f"{detected_equipment[:2].upper()}-01"

    # Detect location
    detected_location = location_hint or "Main Facility"
    if not location_hint:
        loc_patterns = [
            r"(?:in|at|near|inside)\s+([A-Za-z0-9\s\-]+(?:Lab\s*\d*|Room\s*\d*|Floor\s*\d*|Block\s*[A-Za-z0-9]*|Hall|Auditorium|Building|Wing|Office))",
            r"(Computer\s*Lab\s*\d*|Server\s*Room|Lecture\s*Hall\s*\d*|Admin\s*Block|Library|Hostel\s*[A-Za-z0-9]*|Cafeteria|Mess)",
        ]
        for pat in loc_patterns:
            loc_match = re.search(pat, raw_text, re.IGNORECASE)
            if loc_match:
                detected_location = loc_match.group(1).strip()
                break

    # Determine severity
    detected_severity = severity_hint or "Medium"
    if any(
        w in text_lower
        for w in [
            "fire",
            "spark",
            "burning",
            "critical",
            "emergency",
            "stuck with passenger",
            "exploded",
            "flooding",
        ]
    ):
        detected_severity = "Critical"
    elif any(
        w in text_lower
        for w in [
            "urgent",
            "not working",
            "fails to start",
            "breaker trip",
            "leak",
            "shut down",
            "black screen",
        ]
    ):
        detected_severity = "High"
    elif any(
        w in text_lower
        for w in ["noise", "slow", "vibrating", "flickering", "discoloration", "trickle"]
    ):
        detected_severity = "Medium"

    # Extract symptoms
    symptoms = raw_text
    keywords = re.findall(r"\b[a-zA-Z]{3,}\b", text_lower)
    stop_words = {"the", "and", "is", "are", "was", "for", "with", "this", "that", "from", "not"}
    clean_keywords = [w for w in keywords if w not in stop_words][:8]

    return ComplaintAnalysisOutput(
        equipment_type=detected_equipment,
        equipment_id=detected_id,
        location=detected_location,
        symptoms=symptoms,
        severity=detected_severity,
        operational_impact=f"Potential disruption to {detected_location} activities.",
        keywords=clean_keywords,
    )


async def run_analyzer_agent(state: AgentState) -> dict[str, Any]:
    """Execute Agent 1: Complaint Analysis Agent."""
    start_time = time.time()
    raw_complaint = state.get("raw_complaint", "")
    eq_hint = state.get("equipment_hint")
    loc_hint = state.get("location_hint")
    sev_hint = state.get("severity_hint")

    prompt = f"""You are the Complaint Analysis Agent of FacilityMind AI.
Analyze this facility maintenance complaint:
"{raw_complaint}"

Context Hints:
Equipment Hint: {eq_hint or "None"}
Location Hint: {loc_hint or "None"}
Severity Hint: {sev_hint or "None"}

Extract and standardize into a JSON object with:
{{
  "equipment_type": "standardized equipment name (e.g. Air Conditioner, Diesel Generator, Elevator, Water Pump, Classroom Projector, UPS System, RO Water Purifier, Electrical Panel, CCTV Camera, Network Switch)",
  "equipment_id": "equipment code or N/A",
  "location": "precise room, lab, floor, or building",
  "symptoms": "concise bulleted summary of specific mechanical/electrical symptoms",
  "severity": "Low, Medium, High, or Critical",
  "operational_impact": "impact on users and facility operations",
  "keywords": ["list", "of", "domain", "search", "keywords"]
}}"""

    analysis_data = await llm_client.generate_json(
        prompt,
        system_instruction="You extract structured facility equipment maintenance parameters.",
    )

    if analysis_data and "equipment_type" in analysis_data:
        analysis = ComplaintAnalysisOutput(
            equipment_type=analysis_data.get("equipment_type", "General Facility"),
            equipment_id=analysis_data.get("equipment_id", "N/A"),
            location=analysis_data.get("location", loc_hint or "Campus Facility"),
            symptoms=analysis_data.get("symptoms", raw_complaint),
            severity=analysis_data.get("severity", "Medium"),
            operational_impact=analysis_data.get("operational_impact", ""),
            keywords=analysis_data.get("keywords", []),
        )
    else:
        analysis = _rule_based_extraction(raw_complaint, eq_hint, loc_hint, sev_hint)

    exec_time = int((time.time() - start_time) * 1000)
    summary = f"Identified {analysis.equipment_type} ({analysis.equipment_id}) at {analysis.location} [{analysis.severity} Severity]"

    agent_run = {
        "agent_name": "Complaint Analysis Agent",
        "status": "Completed",
        "execution_time_ms": max(exec_time, 20),
        "output_summary": summary,
    }

    return {
        "analysis": analysis,
        "agent_runs": [agent_run],
    }
