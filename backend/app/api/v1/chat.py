"""Gemini Context-Aware AI Chatbot Endpoints for User and Admin Portals.

Provides full conversational intelligence, incident drafting, ticket tracking,
financial telemetry, technician roster analytics, and knowledge base retrieval.
Supports Google Gemini 2.5 Flash with seamless local autonomous semantic fallbacks.
"""

from __future__ import annotations

import json
import os
import re
from typing import Any

import httpx
from backend.app.core.config import get_settings
from backend.app.core.logging import logging
from backend.app.database.session import get_db
from backend.app.models.maintenance import (
    Complaint,
    Equipment,
    MaintenanceRecord,
    Organization,
    TechnicianStaff,
)
from backend.app.rag.retriever import retriever
from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

logger = logging.getLogger("FacilityMind.Chat")
settings = get_settings()

router = APIRouter(prefix="/chat", tags=["Gemini AI Assistant"])


class ChatMessage(BaseModel):
    role: str = Field("user", description="'user' or 'assistant'")
    content: str


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, description="User prompt or question")
    history: list[ChatMessage] = Field(default_factory=list, description="Recent conversation turns")
    context_complaint_id: int | None = None
    user_phone: str | None = None


class DraftComplaintData(BaseModel):
    equipment_type: str | None = None
    equipment: str | None = None
    location: str | None = None
    building: str | None = None
    floor: str | None = None
    room: str | None = None
    symptoms: str | None = None
    raw_complaint: str | None = None
    severity: str | None = "Medium"
    urgency: str | None = "Medium"


class SuggestedAction(BaseModel):
    label: str
    action_type: str  # "draft_complaint", "navigate_tab", "track_ticket", "info"
    payload: dict[str, Any] | None = None


class ChatResponse(BaseModel):
    reply: str
    model: str
    model_used: str = "gemini-2.5-flash"
    source: str = "gemini"
    grounded_context: dict[str, Any] = Field(default_factory=dict)
    suggested_actions: list[SuggestedAction] = []
    draft_complaint: DraftComplaintData | None = None
    complaint_draft: DraftComplaintData | None = None


def extract_incident_draft(
    msg: str,
    categories: list[str] | None = None,
    blocks: list[str] | None = None,
) -> DraftComplaintData | None:
    """Extract structured equipment, location, severity, and symptom draft from free text."""
    msg_clean = msg.strip()
    msg_lower = msg_clean.lower()

    # Determine if message is reporting an incident/breakdown
    complaint_keywords = [
        "broken", "not working", "leak", "leaking", "rattling", "smoke", "spark",
        "warm air", "noise", "stuck", "faulty", "tripping", "blackout", "overflow",
        "repair", "fix", "damage", "smell", "failed", "down", "issue with", "problem with"
    ]
    if not any(k in msg_lower for k in complaint_keywords) and len(msg_clean) < 15:
        return None

    # Detect equipment type
    detected_equip = "General Facility"
    equip_map = {
        "air conditioner": "Air Conditioner",
        "ac": "Air Conditioner",
        "hvac": "Air Conditioner",
        "chiller": "Air Conditioner",
        "cooling": "Air Conditioner",
        "generator": "Diesel Generator",
        "dg": "Diesel Generator",
        "genset": "Diesel Generator",
        "elevator": "Elevator",
        "lift": "Elevator",
        "projector": "Classroom Projector",
        "screen": "Classroom Projector",
        "av": "Classroom Projector",
        "water pump": "Water Pump",
        "pump": "Water Pump",
        "motor": "Water Pump",
        "water purifier": "RO Water Purifier",
        "ro purifier": "RO Water Purifier",
        "cooler": "RO Water Purifier",
        "plumbing": "Restroom / Washroom Plumbing",
        "tap": "Restroom / Washroom Plumbing",
        "pipe": "Restroom / Washroom Plumbing",
        "drain": "Restroom / Washroom Plumbing",
        "flush": "Restroom / Washroom Plumbing",
        "washroom": "Restroom / Washroom Plumbing",
        "toilet": "Restroom / Washroom Plumbing",
        "light": "Lighting & Electrical",
        "bulb": "Lighting & Electrical",
        "tube": "Lighting & Electrical",
        "wiring": "Lighting & Electrical",
        "switch": "Lighting & Electrical",
        "ups": "UPS System",
        "inverter": "UPS System",
        "battery": "UPS System",
        "wifi": "Network Switch / WiFi",
        "router": "Network Switch / WiFi",
        "internet": "Network Switch / WiFi",
        "network": "Network Switch / WiFi",
    }
    if categories:
        for c in categories:
            if c.lower() in msg_lower:
                detected_equip = c
                break

    if detected_equip == "General Facility":
        for k, v in equip_map.items():
            if re.search(rf"\b{re.escape(k)}\b", msg_lower):
                detected_equip = v
                break

    # Detect location
    detected_loc = "Main Campus"
    detected_bldg = ""
    detected_floor = ""
    detected_room = ""

    # Check for room (e.g. Room 204, Lab 3, Hall B)
    room_match = re.search(r"\b(lab\s*\d+|room\s*\d+|hall\s*[a-z0-9]+|flat\s*\d+|ward\s*\d+)\b", msg_lower)
    if room_match:
        detected_room = room_match.group(0).title()

    # Check for floor
    floor_match = re.search(r"\b(ground|1st|2nd|3rd|4th|5th|\d+)\s*(st|nd|rd|th)?\s*floor\b", msg_lower)
    if floor_match:
        detected_floor = floor_match.group(1).title()

    # Check for blocks
    if blocks:
        for b in blocks:
            if b.lower() in msg_lower:
                detected_bldg = b
                break

    if not detected_bldg:
        bldg_match = re.search(r"\b(block\s*[a-z0-9]+|science\s*wing|library|academic\s*block|hostel\s*[a-z0-9]*)\b", msg_lower)
        if bldg_match:
            detected_bldg = bldg_match.group(0).title()

    loc_parts = [detected_bldg, f"Floor {detected_floor}" if detected_floor else "", detected_room]
    loc_clean = ", ".join([p for p in loc_parts if p])
    if not loc_clean:
        loc_clean = detected_loc

    # Determine severity
    detected_severity = "Medium"
    if any(k in msg_lower for k in ["fire", "spark", "burning", "smoke", "flood", "shock", "danger", "emergency", "explosion"]):
        detected_severity = "Critical"
    elif any(k in msg_lower for k in ["severe", "tripping", "stuck", "hot", "completely", "urgent", "overflow"]):
        detected_severity = "High"
    elif any(k in msg_lower for k in ["minor", "slow", "flicker", "cosmetic"]):
        detected_severity = "Low"

    return DraftComplaintData(
        equipment_type=detected_equip,
        equipment=detected_equip,
        location=loc_clean,
        building=detected_bldg,
        floor=detected_floor,
        room=detected_room,
        symptoms=msg_clean,
        raw_complaint=msg_clean,
        severity=detected_severity,
        urgency=detected_severity,
    )


async def _resolve_gemini_api_key(db: AsyncSession) -> str:
    """Resolve Gemini API key from Organization DB profile, settings, or environment."""
    try:
        org_res = await db.execute(select(Organization.gemini_api_key).limit(1))
        db_key = org_res.scalar_one_or_none()
        if db_key and len(db_key.strip()) >= 10:
            return db_key.strip()
    except Exception:
        pass

    env_key = settings.GEMINI_API_KEY or os.getenv("GEMINI_API_KEY", "")
    return env_key.strip() if env_key else ""


async def _generate_gemini_chat_reply(
    prompt: str,
    system_instruction: str,
    history: list[ChatMessage],
    api_key: str,
) -> str | None:
    """Execute real multi-turn generation via Google Gemini 2.5 Flash."""
    if not api_key or len(api_key) < 10:
        return None

    model = settings.DEFAULT_MODEL or "gemini-2.5-flash"
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"

    contents = []
    for h in history[-8:]:
        role = "user" if h.role == "user" else "model"
        contents.append({"role": role, "parts": [{"text": h.content}]})

    contents.append({"role": "user", "parts": [{"text": prompt}]})

    payload = {
        "contents": contents,
        "systemInstruction": {"parts": [{"text": system_instruction}]},
        "generationConfig": {
            "temperature": 0.35,
            "maxOutputTokens": 1400,
        },
    }

    try:
        async with httpx.AsyncClient(timeout=11.0) as client:
            response = await client.post(url, json=payload)
            if response.status_code == 200:
                data = response.json()
                candidates = data.get("candidates", [])
                if candidates:
                    parts = candidates[0].get("content", {}).get("parts", [])
                    if parts:
                        return parts[0].get("text", "")
            else:
                logger.warning(f"Gemini API non-200 [{response.status_code}]: {response.text[:200]}")
    except Exception as e:
        logger.warning(f"Gemini chat API call failed: {e}. Activating autonomous semantic engine.")

    return None


@router.post("/user", response_model=ChatResponse)
async def user_portal_chat(
    request: ChatRequest,
    db: AsyncSession = Depends(get_db),
) -> ChatResponse:
    """Intelligent conversational AI for students, occupants, and campus members."""
    msg = request.message.strip()
    msg_lower = msg.lower()
    user_phone = (request.user_phone or "").strip()

    # 1. Fetch organization profile & categories
    org_res = await db.execute(select(Organization).limit(1))
    org = org_res.scalar_one_or_none()
    org_name = org.name if org else "Campus Facility"
    org_type = org.org_type if org else "Campus"
    operating_hours = org.operating_hours if org else "24/7 Operations"
    categories = json.loads(org.categories_json) if org and org.categories_json else [
        "Air Conditioner", "Diesel Generator", "Elevator", "Classroom Projector",
        "Water Pump", "RO Water Purifier", "Lighting & Electrical", "Plumbing"
    ]
    blocks = json.loads(org.blocks_json) if org and org.blocks_json else ["Main Campus", "Academic Block"]

    # 2. Extract potential complaint draft
    draft = extract_incident_draft(msg, categories, blocks)

    # 3. Look up user's active/recent tickets
    user_complaints: list[Complaint] = []
    if user_phone:
        stmt = (
            select(Complaint)
            .where(Complaint.reporter_phone == user_phone)
            .order_by(desc(Complaint.id))
            .limit(5)
        )
        res = await db.execute(stmt)
        user_complaints = list(res.scalars().all())

    user_tickets_ctx = ""
    if user_complaints:
        lines = [
            f"• Ticket #{c.tracking_code or f'FM-{c.id:04d}'}: {c.equipment_type} at {c.location} | Status: {c.status} ({c.work_order_status})"
            for c in user_complaints
        ]
        user_tickets_ctx = "\n".join(lines)

    # 4. Check for explicit tracking code in query
    queried_complaint: Complaint | None = None
    tcode_match = re.search(r"\b(fm-\d{4}|\b\d{1,4}\b)\b", msg_lower)
    if tcode_match:
        matched_str = tcode_match.group(1).upper()
        if not matched_str.startswith("FM-"):
            try:
                cid = int(matched_str)
                stmt = select(Complaint).where(Complaint.id == cid)
            except ValueError:
                stmt = select(Complaint).where(Complaint.tracking_code == matched_str)
        else:
            stmt = select(Complaint).where(Complaint.tracking_code == matched_str)

        q_res = await db.execute(stmt)
        queried_complaint = q_res.scalar_one_or_none()

    # 5. Build dynamic system instruction for Gemini
    system_instruction = f"""You are the Student & Resident Facility Assistant for {org_name} ({org_type}).
Operating Hours: {operating_hours}.
Supported Equipment Categories: {', '.join(categories[:10])}.
Campus Blocks: {', '.join(blocks[:6])}.

User's Existing Tickets:
{user_tickets_ctx if user_tickets_ctx else 'No previous complaints filed with this phone number.'}

SCOPE & BEHAVIOR RULES:
1. Always be extremely polite, empathetic, structured, and helpful.
2. If the user is describing a broken appliance or breakdown, validate their concern, summarize the issue clearly, and tell them you have created a one-click draft ticket for them.
3. If the user asks about ticket progress, provide clear timeline details and status explanation.
4. Format your response with clear Markdown (headers, bolding, bullet points).
5. Never hallucinate internal manager salaries or private data of other people.
"""

    # 6. Try Gemini API
    api_key = await _resolve_gemini_api_key(db)
    gemini_reply = await _generate_gemini_chat_reply(
        prompt=msg,
        system_instruction=system_instruction,
        history=request.history,
        api_key=api_key,
    )

    suggested_actions: list[SuggestedAction] = []
    if draft:
        suggested_actions.append(
            SuggestedAction(
                label="📝 Apply Draft & Submit Ticket",
                action_type="draft_complaint",
                payload={
                    "equipment_type": draft.equipment_type,
                    "location": draft.location,
                    "severity": draft.severity,
                    "raw_complaint": draft.raw_complaint,
                    "building": draft.building,
                    "floor": draft.floor,
                    "room": draft.room,
                },
            )
        )

    if queried_complaint:
        suggested_actions.append(
            SuggestedAction(
                label=f"🔍 Track #{queried_complaint.tracking_code}",
                action_type="track_ticket",
                payload={"tracking_code": queried_complaint.tracking_code},
            )
        )

    suggested_actions.append(
        SuggestedAction(label="🔍 Track My Tickets", action_type="navigate_tab", payload={"tab": "track"})
    )
    suggested_actions.append(
        SuggestedAction(label="📝 Submit Complaint", action_type="navigate_tab", payload={"tab": "submit"})
    )

    if gemini_reply:
        return ChatResponse(
            reply=gemini_reply,
            model="gemini-2.5-flash",
            source="gemini",
            suggested_actions=suggested_actions,
            draft_complaint=draft,
            complaint_draft=draft,
        )

    # =========================================================================
    # 7. AUTONOMOUS SEMANTIC INTENT ENGINE (When Gemini is offline/unconfigured)
    # =========================================================================

    # Scenario A: Explicit Ticket Lookup
    if queried_complaint:
        reply = (
            f"### 📋 Live Status for #{queried_complaint.tracking_code or queried_complaint.id}\n\n"
            f"• **Equipment**: `{queried_complaint.equipment_type}`\n"
            f"• **Location**: **{queried_complaint.location}**\n"
            f"• **Current Status**: **{queried_complaint.status}** (`{queried_complaint.work_order_status}`)\n"
            f"• **Assigned Specialist**: {queried_complaint.assigned_technician_name or 'Under Triage Assignment'}\n"
            f"• **Reported On**: {queried_complaint.created_at}\n"
        )
        if queried_complaint.public_resolution_notes:
            reply += f"\n**Resolution Notes**: *{queried_complaint.public_resolution_notes}*\n"
        reply += f"\nClick **'Track #{queried_complaint.tracking_code}'** below to view the full chronological timeline!"

        return ChatResponse(
            reply=reply,
            model="facilitymind-semantic-engine",
            source="campus_telemetry",
            suggested_actions=suggested_actions,
        )

    # Scenario B: Incident / Breakdown Reporting Draft
    if draft:
        reply = (
            f"### 📝 Prepared Complaint Ticket Draft\n\n"
            f"I have detected your facility issue and prepared a ready-to-submit ticket:\n\n"
            f"• **Equipment**: `{draft.equipment_type}`\n"
            f"• **Identified Location**: **{draft.location}**\n"
            f"• **Calculated Severity**: **{draft.severity}**\n"
            f"• **Symptom Summary**: *\"{draft.raw_complaint}\"*\n\n"
            f"👉 Click **'Apply Draft & Submit Ticket'** below to immediately fill the submission form and trigger 6-Agent AI diagnosis!"
        )
        return ChatResponse(
            reply=reply,
            model="facilitymind-semantic-engine",
            source="incident_parser",
            suggested_actions=suggested_actions,
            draft_complaint=draft,
            complaint_draft=draft,
        )

    # Scenario C: Inquiring about User's Own Tickets
    if any(w in msg_lower for w in ["my complaint", "my ticket", "status", "track", "progress", "history", "check"]):
        if user_complaints:
            reply = f"### 🔍 Your Registered Tickets ({len(user_complaints)})\n\n"
            for c in user_complaints:
                reply += (
                    f"• **#{c.tracking_code or c.id}** — `{c.equipment_type}` ({c.location}): "
                    f"**{c.status}** (`{c.work_order_status}`)\n"
                )
            reply += "\nClick on any ticket in the **'Live Ticket Tracking'** tab for full audit history."
        else:
            reply = (
                f"### 🔍 Ticket Tracking\n\n"
                f"To track an existing issue:\n"
                f"1. Switch to the **'Live Ticket Tracking'** tab.\n"
                f"2. Enter your **Tracking Code** (e.g., `FM-0001`) or enter your phone number to view all your complaints.\n\n"
                f"**Support Operating Hours:** {operating_hours}"
            )
        return ChatResponse(
            reply=reply,
            model="facilitymind-semantic-engine",
            source="campus_telemetry",
            suggested_actions=suggested_actions,
        )

    # Scenario D: Facility Info, Hours, Location
    if any(w in msg_lower for w in ["hour", "time", "contact", "phone", "admin", "principal", "where", "location", "facility"]):
        reply = (
            f"### 🏛️ {org_name} Facility Overview\n\n"
            f"• **Organization**: {org_name} ({org_type})\n"
            f"• **Operating Hours**: **{operating_hours}**\n"
            f"• **Primary Campus**: {org.primary_location if org else 'Main Campus'}, {org.city if org else ''}\n"
            f"• **Facility Lead**: {org.admin_name if org else 'Director of Infrastructure'}\n"
            f"• **Covered Equipment**: {', '.join(categories[:6])}, and more.\n\n"
            f"Feel free to submit a complaint anytime if equipment is malfunctioning!"
        )
        return ChatResponse(
            reply=reply,
            model="facilitymind-semantic-engine",
            source="org_knowledge",
            suggested_actions=suggested_actions,
        )

    # Scenario E: General Welcome & Guidance
    reply = (
        f"### 👋 Welcome to {org_name} Facility Assistant!\n\n"
        f"I am your automated facility support assistant. Here is what I can do:\n\n"
        f"1. **Report a Breakdown**: Describe any problem (*e.g., \"Central AC in Science Wing 204 is leaking water\"*) and I will prepare a ticket draft for you.\n"
        f"2. **Track a Ticket**: Provide your tracking code (*e.g., `FM-0001`*) to inspect real-time repair progress.\n"
        f"3. **Campus Facility Guide**: Ask about support hours, equipment coverage, or maintenance policies.\n\n"
        f"*How may I assist you today?*"
    )
    return ChatResponse(
        reply=reply,
        model="facilitymind-semantic-engine",
        source="default_guide",
        suggested_actions=suggested_actions,
    )


@router.post("/admin", response_model=ChatResponse)
@router.post("", response_model=ChatResponse)
@router.post("/gemini", response_model=ChatResponse)
async def admin_portal_chat(
    request: ChatRequest,
    db: AsyncSession = Depends(get_db),
) -> ChatResponse:
    """Executive facility management AI co-pilot for administrators and operations directors."""
    msg = request.message.strip()
    msg_lower = msg.lower()

    # 1. Fetch live telemetry
    total_complaints_res = await db.execute(select(func.count(Complaint.id)))
    total_complaints_count = total_complaints_res.scalar() or 0

    active_complaints_res = await db.execute(
        select(func.count(Complaint.id)).where(Complaint.status.not_in(["RESOLVED", "CLOSED", "Resolved"]))
    )
    active_complaints_count = active_complaints_res.scalar() or 0

    resolved_complaints_res = await db.execute(
        select(func.count(Complaint.id)).where(Complaint.status.in_(["RESOLVED", "CLOSED", "Resolved"]))
    )
    resolved_complaints_count = resolved_complaints_res.scalar() or 0

    critical_res = await db.execute(
        select(func.count(Complaint.id)).where(Complaint.severity.in_(["Critical", "High"]))
    )
    critical_count = critical_res.scalar() or 0

    kb_records_res = await db.execute(select(func.count(MaintenanceRecord.id)))
    kb_records_count = kb_records_res.scalar() or 0

    total_spend_res = await db.execute(select(func.sum(Complaint.total_actual_cost)))
    total_spend = total_spend_res.scalar() or 0

    equipment_count_res = await db.execute(select(func.count(Equipment.id)))
    equipment_count = equipment_count_res.scalar() or 0

    # Active work orders details
    complaints_stmt = (
        select(Complaint)
        .options(selectinload(Complaint.timeline_events))
        .where(Complaint.status.not_in(["RESOLVED", "CLOSED", "Resolved"]))
        .order_by(desc(Complaint.id))
        .limit(8)
    )
    res_complaints = await db.execute(complaints_stmt)
    active_complaints = list(res_complaints.scalars().all())

    active_summary = []
    for c in active_complaints:
        active_summary.append(
            f"• #{c.tracking_code or f'FM-{c.id:04d}'}: {c.equipment_type or 'Equipment'} at {c.location or 'Campus'} "
            f"[{c.severity or 'Medium'}] — Status: {c.status} ({c.work_order_status})"
        )
    active_ctx = "\n".join(active_summary) if active_summary else "• None (All active work orders resolved)."

    # Technician roster
    techs_stmt = select(TechnicianStaff).limit(10)
    res_techs = await db.execute(techs_stmt)
    techs = list(res_techs.scalars().all())
    tech_summary = [
        f"• {t.name} ({t.role} - Status: {t.status}, Rate: ₹{t.per_job_rate}/job, Completed: {t.total_jobs_completed}, Earnings: ₹{t.total_earnings})"
        for t in techs
    ]
    tech_ctx = "\n".join(tech_summary) if tech_summary else "No technicians registered in the roster yet."

    # RAG matches if query mentions equipment/repairs
    similar_cases = await retriever.retrieve_similar_cases(query=msg, top_k=3)
    kb_summary = []
    for sc in similar_cases:
        kb_summary.append(
            f"• Case #{sc.get('case_id')}: {sc.get('equipment_type')} - \"{sc.get('complaint')}\" -> Fix: {sc.get('recommended_fix')} (Cost: ₹{sc.get('estimated_cost')})"
        )
    kb_ctx = "\n".join(kb_summary) if kb_summary else f"{kb_records_count} verified repair procedures indexed."

    # Check for complaint draft in admin prompt
    draft = extract_incident_draft(msg)

    # Suggested actions
    suggested_actions = [
        SuggestedAction(label="📊 Command Center", action_type="navigate_tab", payload={"tab": "dashboard"}),
        SuggestedAction(label="👷 Technician Roster", action_type="navigate_tab", payload={"tab": "technicians"}),
        SuggestedAction(label="📈 Cost Analytics", action_type="navigate_tab", payload={"tab": "analytics"}),
        SuggestedAction(label="📚 Knowledge Base", action_type="navigate_tab", payload={"tab": "history"}),
        SuggestedAction(label="⚙️ System Diagnostics", action_type="navigate_tab", payload={"tab": "health"}),
    ]

    if draft:
        suggested_actions.insert(
            0,
            SuggestedAction(
                label="📝 Draft Work Order",
                action_type="draft_complaint",
                payload={
                    "equipment_type": draft.equipment_type,
                    "location": draft.location,
                    "severity": draft.severity,
                    "raw_complaint": draft.raw_complaint,
                },
            ),
        )

    # 2. Try Gemini API
    system_instruction = f"""You are FacilityMind Admin AI Copilot — the executive facility decision intelligence assistant.
You assist facility managers, directors, and operations staff with workload balancing, cost analytics, recurring equipment hotspot identification, technician dispatches, and SLA adherence.

LIVE DATABASE TELEMETRY:
• Total Registered Complaints: {total_complaints_count}
• Active / Pending Complaints: {active_complaints_count}
• Resolved / Closed Complaints: {resolved_complaints_count}
• Critical & High Severity: {critical_count}
• Registered Equipment Assets: {equipment_count}
• Knowledge Base Verified Repair Records: {kb_records_count}
• Total Actual Repair Spend: ₹{total_spend:,}

[Active Open Complaints]:
{active_ctx}

[Technician Operations Roster]:
{tech_ctx}

[Top Retrieved Historical Precedents]:
{kb_ctx}

Provide executive-level, data-backed insights with clear recommendations, numbers, and structured Markdown tables or bullet points.
"""

    api_key = await _resolve_gemini_api_key(db)
    gemini_reply = await _generate_gemini_chat_reply(
        prompt=msg,
        system_instruction=system_instruction,
        history=request.history,
        api_key=api_key,
    )

    grounded_ctx = {
        "total_complaints": total_complaints_count,
        "active_work_orders": active_complaints_count,
        "resolved_work_orders": resolved_complaints_count,
        "critical_count": critical_count,
        "kb_records_count": kb_records_count,
        "total_spend": total_spend,
        "available_technicians": len(techs),
        "equipment_count": equipment_count,
    }

    if gemini_reply:
        return ChatResponse(
            reply=gemini_reply,
            model="gemini-2.5-flash",
            source="gemini",
            grounded_context=grounded_ctx,
            suggested_actions=suggested_actions,
            draft_complaint=draft,
            complaint_draft=draft,
        )

    # =========================================================================
    # 3. AUTONOMOUS SEMANTIC INTENT ENGINE FOR ADMIN COPILOT
    # =========================================================================

    # Scenario A: Statistics, Metrics & Overview
    if any(w in msg_lower for w in ["how many", "count", "metrics", "stats", "overview", "total", "summary", "numbers"]):
        reply = (
            f"### 📊 Facility Operations Telemetry Overview\n\n"
            f"| Metric | Live Value | Status |\n"
            f"| :--- | :--- | :--- |\n"
            f"| **Total Complaints** | **{total_complaints_count}** | Lifetime logged |\n"
            f"| **Active Backlog** | **{active_complaints_count}** | {('Action Required' if active_complaints_count > 0 else 'Optimal')} |\n"
            f"| **Resolved Tickets** | **{resolved_complaints_count}** | Verified complete |\n"
            f"| **Critical / High Priority** | **{critical_count}** | {('⚠️ Needs Attention' if critical_count > 0 else 'All Clear')} |\n"
            f"| **Active Technicians** | **{len(techs)}** | On roster |\n"
            f"| **Total Managed Spend** | **₹{total_spend:,}** | Labor & Parts Settlement |\n\n"
            f"**Current Pipeline Queue:**\n{active_ctx}"
        )
        return ChatResponse(
            reply=reply,
            model="facilitymind-semantic-admin",
            source="live_telemetry",
            grounded_context=grounded_ctx,
            suggested_actions=suggested_actions,
        )

    # Scenario B: Financial, Cost, and Outlay Analysis
    if any(w in msg_lower for w in ["cost", "spend", "money", "budget", "finance", "expense", "rupees", "inr"]):
        avg_spend = round(total_spend / max(resolved_complaints_count, 1))
        reply = (
            f"### 💰 Financial & Expenditure Intelligence\n\n"
            f"• **Total Recorded Spend**: **₹{total_spend:,}**\n"
            f"• **Average Cost per Resolved Incident**: **₹{avg_spend:,}**\n"
            f"• **Resolved Incidents Settled**: **{resolved_complaints_count}**\n"
            f"• **Active Unsettled Backlog**: **{active_complaints_count} work orders**\n\n"
            f"**Cost Optimization Insight**:\n"
            f"Technicians settle labor and replacement parts upon complaint resolution. All amounts are audited against historical RAG benchmarks to prevent vendor inflation.\n\n"
            f"Click **'Cost Analytics'** below to view monthly burn rates and category breakdowns."
        )
        return ChatResponse(
            reply=reply,
            model="facilitymind-semantic-admin",
            source="financial_engine",
            grounded_context=grounded_ctx,
            suggested_actions=suggested_actions,
        )

    # Scenario C: Technician Roster & Staff Management
    if any(w in msg_lower for w in ["technician", "staff", "worker", "roster", "labor", "who is available", "rate"]):
        if techs:
            reply = f"### 👷 Active Technician Roster ({len(techs)})\n\n"
            reply += "| Technician Name | Trade / Specialty | Status | Rate / Job | Jobs Done | Total Earnings |\n"
            reply += "| :--- | :--- | :--- | :--- | :--- | :--- |\n"
            for t in techs:
                reply += f"| **{t.name}** | {t.role} | `{t.status}` | ₹{t.per_job_rate} | {t.total_jobs_completed} | ₹{t.total_earnings:,} |\n"
            reply += "\nClick **'Technician Roster'** below to add staff or assign pending work orders."
        else:
            reply = (
                "### 👷 Technician Management\n\n"
                "Currently, there are **0 technicians** registered in the database.\n"
                "You can add on-duty technicians and contractors via the **'Staff & Payouts'** tab."
            )
        return ChatResponse(
            reply=reply,
            model="facilitymind-semantic-admin",
            source="roster_engine",
            grounded_context=grounded_ctx,
            suggested_actions=suggested_actions,
        )

    # Scenario D: Critical & Urgent Issues
    if any(w in msg_lower for w in ["critical", "urgent", "emergency", "backlog", "pending", "high priority"]):
        critical_complaints = [c for c in active_complaints if c.severity in ["Critical", "High"]]
        if critical_complaints:
            reply = f"### 🚨 High-Priority / Critical Backlog ({len(critical_complaints)})\n\n"
            for c in critical_complaints:
                reply += (
                    f"• **#{c.tracking_code or c.id}** — `{c.equipment_type}` at **{c.location}**\n"
                    f"  - Severity: **{c.severity}** | Stage: `{c.work_order_status}`\n"
                    f"  - Assigned: {c.assigned_technician_name or '⚠️ Needs Dispatch'}\n"
                    f"  - Reported: {c.created_at}\n\n"
                )
            reply += "Immediate technician dispatch is recommended for all critical hazards."
        else:
            reply = (
                f"### ✅ Priority Queue Clean\n\n"
                f"There are currently **0 critical or high-severity** unresolved incidents in the backlog.\n"
                f"Total active tickets: **{active_complaints_count}**"
            )
        return ChatResponse(
            reply=reply,
            model="facilitymind-semantic-admin",
            source="triage_engine",
            grounded_context=grounded_ctx,
            suggested_actions=suggested_actions,
        )

    # Scenario E: Incident / Work Order Draft
    if draft:
        reply = (
            f"### 📝 Work Order Draft Generated\n\n"
            f"• **Equipment**: `{draft.equipment_type}`\n"
            f"• **Target Location**: **{draft.location}**\n"
            f"• **Severity**: **{draft.severity}**\n"
            f"• **Issue Narrative**: *\"{draft.raw_complaint}\"*\n\n"
            f"Click **'Draft Work Order'** below to load this into the intake form and run the multi-agent diagnostic engine."
        )
        return ChatResponse(
            reply=reply,
            model="facilitymind-semantic-admin",
            source="incident_parser",
            grounded_context=grounded_ctx,
            suggested_actions=suggested_actions,
            draft_complaint=draft,
            complaint_draft=draft,
        )

    # Scenario F: Multi-Agent AI Workflow Explanation
    if any(w in msg_lower for w in ["agent", "langgraph", "workflow", "how it works", "pipeline", "architecture", "ai"]):
        reply = (
            "### 🤖 FacilityMind 6-Agent LangGraph Architecture\n\n"
            "When a complaint is submitted, it is processed through 6 autonomous nodes:\n\n"
            "1. **Analyzer Agent**: Extracts equipment type, building, room, symptom taxonomy, and severity.\n"
            "2. **Retrieval Agent**: Queries the vector index in <50ms for the top historical repair precedents.\n"
            "3. **Diagnosis Agent**: Synthesizes symptoms with historical evidence via Google Gemini 2.5 Flash.\n"
            "4. **Recommendation Agent**: Prescribes numbered repair steps, required spare parts, diagnostic tools, and cost bounds in ₹ INR.\n"
            "5. **Explanation Agent**: Generates transparent, human-readable rationale for executive review.\n"
            "6. **Validation Supervisor**: Verifies safety bounds, cost sanity, and dispatches real-time WebSocket events."
        )
        return ChatResponse(
            reply=reply,
            model="facilitymind-semantic-admin",
            source="architecture_knowledge",
            grounded_context=grounded_ctx,
            suggested_actions=suggested_actions,
        )

    # Scenario G: Knowledge Base & Historical Cases
    if any(w in msg_lower for w in ["knowledge base", "precedent", "historical", "similar", "past fix", "solution"]):
        if similar_cases:
            reply = f"### 📚 Top Matching Historical Precedents ({len(similar_cases)})\n\n"
            for sc in similar_cases:
                reply += (
                    f"• **Case #{sc.get('case_id')}** (`{sc.get('equipment_type')}`):\n"
                    f"  - Complaint: *\"{sc.get('complaint')}\"*\n"
                    f"  - Fix: {sc.get('recommended_fix')}\n"
                    f"  - Estimated Cost: **₹{sc.get('estimated_cost')}**\n\n"
                )
        else:
            reply = (
                f"### 📚 Facility Knowledge Base\n\n"
                f"The system contains **{kb_records_count} indexed repair procedures**.\n"
                f"You can search or contribute new precedent cases in the **'Knowledge Base'** tab."
            )
        return ChatResponse(
            reply=reply,
            model="facilitymind-semantic-admin",
            source="rag_engine",
            grounded_context=grounded_ctx,
            suggested_actions=suggested_actions,
        )

    # Default Executive Briefing
    reply = (
        f"### 🛡️ Facility Operations Executive Briefing\n\n"
        f"• **Total Tickets Logged**: **{total_complaints_count}**\n"
        f"• **Active Backlog**: **{active_complaints_count} open**\n"
        f"• **Resolved Tickets**: **{resolved_complaints_count}**\n"
        f"• **Total Recorded Spend**: **₹{total_spend:,}**\n"
        f"• **Staff Roster**: **{len(techs)} technicians**\n\n"
        f"**Active Queue Snapshot:**\n{active_ctx}\n\n"
        f"*Ask me to query specific equipment, draft a work order, audit expenses, or inspect technician availability!*"
    )

    return ChatResponse(
        reply=reply,
        model="facilitymind-semantic-admin",
        source="executive_overview",
        grounded_context=grounded_ctx,
        suggested_actions=suggested_actions,
    )
