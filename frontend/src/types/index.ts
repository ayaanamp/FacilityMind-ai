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
  total_complaints_count?: number;
  pending_complaints_count?: number;
  total_users_count?: number;
  total_equipment_count?: number;
  total_expenses_inr?: number;
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

export interface OrganizationProfile {
  id: number;
  name: string;
  org_type: string;
  custom_org_type?: string | null;
  country: string;
  state: string;
  city: string;
  primary_location: string;
  admin_name: string;
  admin_email?: string | null;
  admin_role: string;
  admin_phone?: string | null;
  buildings_count: number;
  floors_count: number;
  approx_users_count: number;
  operating_hours: string;
  categories: string[];
  blocks?: string[];
  gemini_api_key_configured: boolean;
  setup_completed: boolean;
  created_at: string;
  updated_at: string;
}

export interface WorkspaceStats {
  complaints_count: number;
  active_complaints_count: number;
  resolved_complaints_count: number;
  equipment_count: number;
  maintenance_records_count: number;
  technicians_count: number;
}

export interface OrganizationStatus {
  setup_completed: boolean;
  is_fresh_install: boolean;
  organization?: OrganizationProfile | null;
  stats: WorkspaceStats;
  suggested_categories: string[];
}

export interface EquipmentItem {
  id: number;
  organization_id?: number | null;
  equipment_name: string;
  equipment_type: string;
  equipment_id: string;
  location: string;
  building?: string;
  floor?: string;
  department?: string;
  manufacturer?: string;
  model?: string;
  serial_number?: string;
  installation_date?: string;
  status: 'Operational' | 'Degraded' | 'Under Maintenance' | 'Offline' | string;
  criticality: 'Low' | 'Medium' | 'High' | 'Critical' | string;
  created_at: string;
}

export interface ApiKeyVerifyResponse {
  valid: boolean;
  message: string;
}

export interface ComplaintTimelineEvent {
  id: number;
  complaint_id: number;
  event_type: 'SUBMITTED' | 'AI_ANALYZED' | 'UNDER_REVIEW' | 'ASSIGNED' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED' | 'REOPENED' | string;
  actor_name: string;
  actor_role: 'User' | 'Admin' | 'System' | 'Technician' | string;
  message: string;
  created_at: string;
}

export interface NotificationItem {
  id: number;
  organization_id?: number | null;
  recipient_phone?: string | null;
  complaint_id?: number | null;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

export interface ComplaintTrackItem {
  id: number;
  tracking_code: string;
  title?: string | null;
  raw_complaint: string;
  equipment_type?: string | null;
  equipment_id?: string | null;
  location?: string | null;
  building?: string | null;
  floor?: string | null;
  room?: string | null;
  severity: string;
  status: string;
  work_order_status?: string | null;
  reporter_name?: string | null;
  reporter_dept?: string | null;
  noticed_at?: string | null;
  created_at?: string | null;
  resolved_at?: string | null;
  public_resolution_notes?: string | null;
  assigned_technician_name?: string | null;
  timeline_events: ComplaintTimelineEvent[];
}

export interface OrganizationPublic {
  name: string;
  org_type: string;
  primary_location: string;
  operating_hours: string;
  categories: string[];
  blocks: string[];
  emergency_phone: string;
  setup_completed: boolean;
}

export interface AdminUser {
  id: number;
  username: string;
  full_name: string;
  email: string;
  phone: string;
  role: string;
  organization_id?: number | null;
  last_login?: string | null;
}

export interface AdminLoginResponse {
  access_token: string;
  token_type: string;
  user: AdminUser;
}

export interface CategorySpendItem {
  category: string;
  complaint_count: number;
  parts_cost: number;
  labor_cost: number;
  other_cost: number;
  total_cost: number;
}

export interface LocationMetricItem {
  location: string;
  count: number;
  resolved: number;
  open: number;
}

export interface MonthlySpendItem {
  month: string;
  complaints: number;
  spend: number;
}

export interface WorkerWorkloadItem {
  worker_id: number;
  name: string;
  department: string;
  status: string;
  completed_jobs: number;
  total_earnings: number;
}

export interface AnalyticsResponse {
  total_complaints: number;
  open_complaints: number;
  in_progress_complaints: number;
  resolved_complaints: number;
  critical_complaints: number;
  average_resolution_hours: number;
  total_spend_inr: number;
  pending_estimated_spend_inr: number;
  total_equipment_count: number;
  total_workers_count: number;
  category_spending: CategorySpendItem[];
  location_metrics: LocationMetricItem[];
  monthly_spending: MonthlySpendItem[];
  worker_workloads: WorkerWorkloadItem[];
}

export interface ComplaintResolvePayload {
  resolution_notes: string;
  assigned_technician_id?: number | null;
  assigned_technician_name?: string | null;
  labor_cost?: number;
  parts_cost?: number;
  other_cost?: number;
  internal_admin_notes?: string | null;
}

export interface ComplaintReopenPayload {
  reason: string;
  actor_name?: string;
}


