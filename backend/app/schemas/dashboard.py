"""Schemas for Dashboard telemetry and analytics."""

from pydantic import BaseModel


class UrgencyBreakdown(BaseModel):
    """Urgency distribution counts."""

    Low: int
    Medium: int
    High: int
    Critical: int


class EquipmentStat(BaseModel):
    """Equipment failure frequency and cost breakdown."""

    equipment_type: str
    count: int
    avg_cost: int
    total_cost: int


class LocationStat(BaseModel):
    """Location complaint volume."""

    location: str
    count: int


class MonthlyTrend(BaseModel):
    """Monthly maintenance incident and cost trends."""

    month: str
    incidents: int
    cost: int


class WorkOrderItem(BaseModel):
    """Active work order with multi-stage progress tracking."""

    id: int
    work_order_code: str
    complaint_id: int
    equipment_type: str
    location: str
    symptoms: str
    reporter_name: str
    reporter_dept: str
    noticed_at: str
    reporter_phone: str | None = None
    stage: str  # Triage Pending, Technician Assigned, In Repair, Quality Audit, Completed
    progress_percent: int
    urgency: str
    estimated_cost: int
    repair_time_hours: float
    technician_required: str
    assigned_technician_id: int | None = None
    assigned_technician_name: str | None = None
    labor_cost: int = 0
    parts_cost: int = 0
    total_actual_cost: int = 0
    created_at: str


class PredictiveAlertItem(BaseModel):
    """Predictive failure alert for equipment based on wear-and-tear models."""

    id: str
    equipment_type: str
    risk_level: str  # Critical Risk, High Wear, Moderate Wear
    wear_index_pct: int
    mean_time_between_failures_days: int
    predicted_failure_mode: str
    recommended_action: str
    estimated_preventive_cost: int
    historical_incident_count: int
    urgency: str
    location_hotspot: str


class SpendingBudgetPoint(BaseModel):
    """Monthly cumulative spending vs budget allocation data point."""

    month: str
    budget_allocation: int
    actual_spending: int
    labor_spend: int
    parts_spend: int
    cumulative_spend: int


class DashboardMetricsResponse(BaseModel):
    """Aggregated command center dashboard statistics."""

    total_historical_records: int
    active_complaints: int
    ai_assisted_diagnoses: int
    resolved_cases: int
    critical_issues_count: int
    avg_resolution_time_hours: float
    total_estimated_cost_inr: int
    total_labor_paid_inr: int = 0
    total_active_cost_inr: int = 0
    total_technicians_count: int = 0
    urgency_distribution: UrgencyBreakdown
    equipment_breakdown: list[EquipmentStat]
    location_breakdown: list[LocationStat]
    monthly_trends: list[MonthlyTrend]
    active_work_orders: list[WorkOrderItem] = []
    predictive_alerts: list[PredictiveAlertItem] = []
    spending_vs_budget: list[SpendingBudgetPoint] = []
