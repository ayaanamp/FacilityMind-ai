export interface ComplaintAnalysis {
  equipment_type: string;
  equipment_id: string;
  location: string;
  symptoms: string;
  severity: 'Low' | 'Medium' | 'High' | 'Critical';
  operational_impact: string;
  keywords: string[];
}

export interface SimilarCase {
  case_id: number;
  similarity_score: number;
  similarity_percentage: number;
  equipment_type: string;
  equipment_id: string;
  location: string;
  complaint: string;
  symptoms: string;
  diagnosis: string;
  root_cause: string;
  recommended_fix: string;
  estimated_cost: number;
  repair_time: number;
  urgency: string;
  technician_type: string;
  date: string;
  technician_notes: string;
}

export interface DiagnosisData {
  primary_cause: string;
  possible_causes: string[];
  confidence_level: 'High Evidence' | 'Moderate Evidence' | 'Limited Evidence' | string;
  supporting_cases: number[];
  reasoning_summary: string;
  is_fallback: boolean;
}

export interface RecommendationData {
  action: string;
  repair_steps: string[];
  estimated_cost_min: number;
  estimated_cost_max: number;
  repair_time_hours: number;
  urgency: 'Low' | 'Medium' | 'High' | 'Critical' | string;
  technician_required: string;
  required_tools: string[];
  replacement_parts: string[];
}

export interface ExplanationData {
  explanation_points: string[];
  full_text: string;
}

export interface AgentRun {
  agent_name: string;
  status: string;
  execution_time_ms: number;
  output_summary: string;
}

export interface DecisionReport {
  complaint_id: number;
  raw_complaint: string;
  status: string;
  created_at: string;
  analysis: ComplaintAnalysis;
  similar_cases: SimilarCase[];
  diagnosis: DiagnosisData;
  recommendation: RecommendationData;
  explanation: ExplanationData;
  agent_runs: AgentRun[];
  is_fallback: boolean;
  human_verified: boolean;
  technician_feedback?: {
    accepted: boolean;
    technician_name: string;
    technician_feedback: string;
    corrected_diagnosis?: string;
    appended_to_kb: boolean;
  } | null;
}

export interface MaintenanceRecordItem {
  id: number;
  equipment_type: string;
  equipment_id: string;
  location: string;
  complaint: string;
  symptoms: string;
  diagnosis: string;
  root_cause: string;
  recommended_fix: string;
  estimated_cost: number;
  repair_time: number;
  urgency: string;
  technician_type: string;
  date: string;
  technician_notes: string;
  status: string;
}

export interface WorkOrderItem {
  id: number;
  work_order_code: string;
  complaint_id: number;
  equipment_type: string;
  location: string;
  symptoms: string;
  reporter_name: string;
  reporter_dept: string;
  noticed_at: string;
  reporter_phone?: string;
  stage: 'Triage Pending' | 'Technician Assigned' | 'In Repair' | 'Quality Audit' | 'Completed' | string;
  progress_percent: number;
  urgency: string;
  estimated_cost: number;
  repair_time_hours: number;
  technician_required: string;
  assigned_technician_id?: number;
  assigned_technician_name?: string;
  labor_cost?: number;
  parts_cost?: number;
  total_actual_cost?: number;
  created_at: string;
}

export interface PredictiveAlert {
  id: string;
  equipment_type: string;
  risk_level: string;
  wear_index_pct: number;
  mean_time_between_failures_days: number;
  predicted_failure_mode: string;
  recommended_action: string;
  estimated_preventive_cost: number;
  historical_incident_count: number;
  urgency: string;
  location_hotspot: string;
}

export interface SpendingBudgetPoint {
  month: string;
  budget_allocation: number;
  actual_spending: number;
  labor_spend: number;
  parts_spend: number;
  cumulative_spend: number;
}

export interface DashboardMetrics {
  total_historical_records: number;
  active_complaints: number;
  ai_assisted_diagnoses: number;
  resolved_cases: number;
  critical_issues_count: number;
  avg_resolution_time_hours: number;
  total_estimated_cost_inr: number;
  total_labor_paid_inr?: number;
  total_active_cost_inr?: number;
  total_technicians_count?: number;
  urgency_distribution: {
    Low: number;
    Medium: number;
    High: number;
    Critical: number;
  };
  equipment_breakdown: Array<{
    equipment_type: string;
    count: number;
    avg_cost: number;
    total_cost: number;
  }>;
  location_breakdown: Array<{
    location: string;
    count: number;
  }>;
  monthly_trends: Array<{
    month: string;
    incidents: number;
    cost: number;
  }>;
  active_work_orders: WorkOrderItem[];
  predictive_alerts?: PredictiveAlert[];
  spending_vs_budget?: SpendingBudgetPoint[];
}

export interface TechnicianStaff {
  id: number;
  name: string;
  phone: string;
  role: string;
  hourly_rate: number;
  per_job_rate: number;
  total_jobs_completed: number;
  total_earnings: number;
  status: 'Available' | 'On Job' | 'Off Duty' | string;
  joined_date: string;
}

export interface TechniciansSummary {
  technicians: TechnicianStaff[];
  total_technicians: number;
  active_on_duty: number;
  total_labor_paid_inr: number;
  total_jobs_completed: number;
  spending_vs_budget?: SpendingBudgetPoint[];
}

export interface ComplaintDossierItem {
  id: number;
  work_order_code: string;
  reporter_name: string;
  reporter_phone: string;
  reporter_dept: string;
  location: string;
  equipment_type: string;
  noticed_at: string;
  created_at: string;
  severity: string;
  status: string;
  work_order_status: string;
  raw_complaint: string;
  symptoms: string;
  primary_cause: string;
  action_recommended: string;
  estimated_cost: number;
  assigned_technician_name?: string;
  assigned_technician_id?: number;
  labor_cost: number;
  parts_cost: number;
  total_actual_cost: number;
}

export interface HealthResponse {
  status: string;
  environment: string;
  version: string;
  services: Record<string, string>;
}

export interface TechnicianFeedbackPayload {
  complaint_id: number;
  accepted: boolean;
  technician_name: string;
  technician_feedback: string;
  corrected_diagnosis?: string;
  corrected_fix?: string;
  actual_cost?: number;
}

export interface GeminiChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: string;
}

export interface GeminiChatAction {
  label: string;
  action_type: 'draft_complaint' | 'navigate_tab' | 'query_kb' | string;
  payload?: any;
}

export interface GeminiChatResponse {
  reply: string;
  source: 'gemini' | 'grounded_rules' | 'rag_knowledge' | string;
  model_used: string;
  grounded_context?: Record<string, any>;
  suggested_actions?: Array<GeminiChatAction | string>;
  draft_complaint?: {
    equipment_type?: string;
    equipment?: string;
    location?: string;
    severity?: string;
    urgency?: string;
    raw_complaint?: string;
    symptoms?: string;
  } | null;
  complaint_draft?: {
    equipment_type?: string;
    equipment?: string;
    location?: string;
    severity?: string;
    urgency?: string;
    raw_complaint?: string;
    symptoms?: string;
  } | null;
}


