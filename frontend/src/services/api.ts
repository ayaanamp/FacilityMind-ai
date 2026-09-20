import {
  AdminLoginResponse,
  AdminUser,
  AnalyticsResponse,
  ApiKeyVerifyResponse,
  ComplaintDossierItem,
  DashboardMetrics,
  DecisionReport,
  EquipmentItem,
  GeminiChatResponse,
  HealthResponse,
  MaintenanceRecordItem,
  OrganizationProfile,
  OrganizationPublic,
  OrganizationStatus,
  SimilarCase,
  TechnicianFeedbackPayload,
  TechnicianStaff,
  TechniciansSummary,
} from '../types';


export function getApiBaseUrl(): string {
  // 1. Check dynamic runtime override in localStorage
  if (typeof window !== 'undefined' && window.localStorage) {
    const custom = window.localStorage.getItem('fm_api_base_url');
    if (custom && custom.trim()) {
      let u = custom.trim().replace(/\/+$/, '');
      if (!u.endsWith('/api/v1')) {
        u = `${u}/api/v1`;
      }
      return u;
    }
  }

  // 2. Check Vite build-time environment variable
  const envUrl = import.meta.env.VITE_API_BASE_URL;
  if (envUrl && typeof envUrl === 'string' && envUrl.trim()) {
    let u = envUrl.trim().replace(/\/+$/, '');
    if (!u.endsWith('/api/v1')) {
      u = `${u}/api/v1`;
    }
    return u;
  }

  // 3. Localhost development fallback
  if (typeof window !== 'undefined' && window.location) {
    const host = window.location.hostname || 'localhost';
    if (host === 'localhost' || host === '127.0.0.1') {
      const proto = window.location.protocol === 'https:' ? 'https:' : 'http:';
      return `${proto}//${host}:8000/api/v1`;
    }
  }

  return 'http://localhost:8000/api/v1';
}

export function setCustomApiBaseUrl(url: string): void {
  if (typeof window !== 'undefined' && window.localStorage) {
    if (!url || !url.trim()) {
      window.localStorage.removeItem('fm_api_base_url');
    } else {
      let clean = url.trim().replace(/\/+$/, '');
      if (!clean.endsWith('/api/v1')) {
        clean = `${clean}/api/v1`;
      }
      window.localStorage.setItem('fm_api_base_url', clean);
    }
  }
}

export function getEffectiveApiBase(): string {
  return getApiBaseUrl();
}

const API_BASE = getApiBaseUrl();

export interface ApiLogEntry {
  timestamp: string;
  method: string;
  url: string;
  status: number | string;
  durationMs: number;
  success: boolean;
  error?: string;
}

const apiLogHistory: ApiLogEntry[] = [];

export function getApiLogs(): ApiLogEntry[] {
  return [...apiLogHistory];
}

async function loggedFetch(url: string, options?: RequestInit): Promise<Response> {
  const start = performance.now();
  const method = options?.method || 'GET';
  
  // Attach Authorization token if available in storage and not explicitly overridden
  const token = localStorage.getItem('fm_admin_token');
  const headers = new Headers(options?.headers || {});
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const mergedOptions: RequestInit = {
    ...options,
    headers,
  };

  try {
    const res = await fetch(url, mergedOptions);
    const duration = Math.round(performance.now() - start);
    
    if (!res.ok) {
      console.warn(`[FacilityMind API] ${method} ${url} -> ${res.status} (${duration}ms)`);
    } else {
      console.log(`[FacilityMind API] ${method} ${url} -> ${res.status} (${duration}ms)`);
    }
    
    apiLogHistory.unshift({
      timestamp: new Date().toISOString(),
      method,
      url,
      status: res.status,
      durationMs: duration,
      success: res.ok,
    });
    if (apiLogHistory.length > 50) apiLogHistory.pop();
    
    return res;
  } catch (err: any) {
    const duration = Math.round(performance.now() - start);
    console.error(`[FacilityMind API] ${method} ${url} FAILED (${duration}ms):`, err?.message || err);
    apiLogHistory.unshift({
      timestamp: new Date().toISOString(),
      method,
      url,
      status: 'NETWORK_ERROR',
      durationMs: duration,
      success: false,
      error: err?.message || 'Network error',
    });
    if (apiLogHistory.length > 50) apiLogHistory.pop();
    throw err;
  }
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const errorText = await res.text();
    let message = `API request failed with status ${res.status}`;
    try {
      const errJson = JSON.parse(errorText);
      if (typeof errJson.detail === 'string') {
        message = errJson.detail;
      } else if (Array.isArray(errJson.detail)) {
        message = errJson.detail
          .map((d: any) => (typeof d === 'string' ? d : `${d.loc ? d.loc.slice(1).join('.') + ': ' : ''}${d.msg || JSON.stringify(d)}`))
          .join('; ');
      } else if (errJson.message) {
        message = String(errJson.message);
      }
    } catch {
      // Use fallback error message
    }
    throw new Error(message);
  }
  return res.json();
}


export async function fetchHealth(): Promise<HealthResponse> {
  const res = await loggedFetch(`${API_BASE}/health`);
  return handleResponse<HealthResponse>(res);
}

export async function fetchDashboardMetrics(): Promise<DashboardMetrics> {
  const res = await loggedFetch(`${API_BASE}/dashboard`);
  return handleResponse<DashboardMetrics>(res);
}

export async function analyzeComplaint(payload: {
  raw_complaint: string;
  equipment_type?: string;
  equipment_id?: string;
  location?: string;
  severity?: string;
  reporter_name?: string;
  reporter_dept?: string;
  noticed_at?: string;
  reporter_phone?: string;
}): Promise<DecisionReport> {
  const res = await loggedFetch(`${API_BASE}/complaints`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return handleResponse<DecisionReport>(res);
}

export async function fetchComplaintDecision(complaintId: number): Promise<DecisionReport> {
  const res = await loggedFetch(`${API_BASE}/complaints/${complaintId}/decision`);
  return handleResponse<DecisionReport>(res);
}

export const fetchDecisionReport = fetchComplaintDecision;

export async function clearAllComplaints(): Promise<{ success: boolean; message: string }> {
  const res = await loggedFetch(`${API_BASE}/complaints/clear`, {
    method: 'POST',
  });
  return handleResponse<{ success: boolean; message: string }>(res);
}

export async function hardResetWorkspace(): Promise<{ success: boolean; message: string }> {
  const res = await loggedFetch(`${API_BASE}/complaints/hard-reset`, {
    method: 'POST',
  });
  return handleResponse<{ success: boolean; message: string }>(res);
}

export async function deleteComplaint(complaintId: number): Promise<{ success: boolean; message: string }> {
  const res = await loggedFetch(`${API_BASE}/complaints/${complaintId}`, {
    method: 'DELETE',
  });
  return handleResponse<{ success: boolean; message: string }>(res);
}

export async function batchDeleteComplaints(
  complaintIds: number[]
): Promise<{ success: boolean; deleted_count: number; message: string }> {
  const res = await loggedFetch(`${API_BASE}/complaints/batch-delete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ complaint_ids: complaintIds }),
  });
  return handleResponse<{ success: boolean; deleted_count: number; message: string }>(res);
}

export async function updateComplaintStatus(
  complaintId: number,
  payload: { status?: string; work_order_status?: string }
): Promise<{ success: boolean; status: string; work_order_status: string }> {
  const res = await loggedFetch(`${API_BASE}/complaints/${complaintId}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return handleResponse<{ success: boolean; status: string; work_order_status: string }>(res);
}

export async function rateDiagnosisAccuracy(
  complaintId: number,
  rating: number
): Promise<{ success: boolean; accuracy_rating: number; message: string }> {
  const res = await loggedFetch(`${API_BASE}/complaints/${complaintId}/rating`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rating }),
  });
  return handleResponse<{ success: boolean; accuracy_rating: number; message: string }>(res);
}

export async function createMaintenanceRecord(payload: Record<string, unknown>): Promise<{
  success: boolean;
  record_id: number;
  message: string;
  record: MaintenanceRecordItem;
}> {
  const res = await loggedFetch(`${API_BASE}/maintenance/records`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return handleResponse<{
    success: boolean;
    record_id: number;
    message: string;
    record: MaintenanceRecordItem;
  }>(res);
}

export async function searchSimilarCases(
  query: string,
  equipmentType?: string,
  limit: number = 6
): Promise<SimilarCase[]> {
  const params = new URLSearchParams({ q: query, limit: limit.toString() });
  if (equipmentType) {
    params.append('equipment_type', equipmentType);
  }
  const res = await loggedFetch(`${API_BASE}/cases/similar?${params.toString()}`);
  return handleResponse<SimilarCase[]>(res);
}

export async function fetchMaintenanceRecords(params?: {
  search?: string;
  equipment_type?: string;
  location?: string;
  urgency?: string;
  status?: string;
  skip?: number;
  limit?: number;
}): Promise<{ total: number; skip: number; limit: number; records: MaintenanceRecordItem[] }> {
  const urlParams = new URLSearchParams();
  if (params?.search) urlParams.append('search', params.search);
  if (params?.equipment_type) urlParams.append('equipment_type', params.equipment_type);
  if (params?.location) urlParams.append('location', params.location);
  if (params?.urgency) urlParams.append('urgency', params.urgency);
  if (params?.status) urlParams.append('status', params.status);
  if (params?.skip !== undefined) urlParams.append('skip', params.skip.toString());
  if (params?.limit !== undefined) urlParams.append('limit', params.limit.toString());

  const res = await loggedFetch(`${API_BASE}/maintenance?${urlParams.toString()}`);
  return handleResponse<{ total: number; skip: number; limit: number; records: MaintenanceRecordItem[] }>(res);
}

export async function deleteMaintenanceRecord(
  recordId: number
): Promise<{ success: boolean; message: string }> {
  const res = await loggedFetch(`${API_BASE}/maintenance/records/${recordId}`, {
    method: 'DELETE',
  });
  return handleResponse<{ success: boolean; message: string }>(res);
}

export async function updateMaintenanceRecordStatus(
  recordId: number,
  status: string,
  notes?: string
): Promise<{ success: boolean; record_id: number; status: string; message: string }> {
  const res = await loggedFetch(`${API_BASE}/maintenance/records/${recordId}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status, technician_notes: notes }),
  });
  return handleResponse<{ success: boolean; record_id: number; status: string; message: string }>(res);
}

export async function clearAllMaintenanceRecords(): Promise<{ success: boolean; message: string }> {
  const res = await loggedFetch(`${API_BASE}/maintenance/records/clear-all`, {
    method: 'POST',
  });
  return handleResponse<{ success: boolean; message: string }>(res);
}

export async function reseedMaintenanceRecords(): Promise<{
  success: boolean;
  inserted_count: number;
  total_records: number;
  vector_index_size: number;
  message: string;
}> {
  const res = await loggedFetch(`${API_BASE}/maintenance/records/reseed`, {
    method: 'POST',
  });
  return handleResponse<{
    success: boolean;
    inserted_count: number;
    total_records: number;
    vector_index_size: number;
    message: string;
  }>(res);
}


export async function fetchEquipmentCategories(): Promise<Array<{ type: string; count: number }>> {
  const res = await loggedFetch(`${API_BASE}/equipment`);
  return handleResponse<Array<{ type: string; count: number }>>(res);
}

export async function fetchLocations(): Promise<Array<{ location: string; count: number }>> {
  const res = await loggedFetch(`${API_BASE}/locations`);
  return handleResponse<Array<{ location: string; count: number }>>(res);
}

export async function submitTechnicianFeedback(payload: TechnicianFeedbackPayload): Promise<{
  id: number;
  complaint_id: number;
  accepted: boolean;
  appended_to_kb: boolean;
  new_knowledge_record_id?: number;
}> {
  const res = await loggedFetch(`${API_BASE}/feedback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return handleResponse<{
    id: number;
    complaint_id: number;
    accepted: boolean;
    appended_to_kb: boolean;
    new_knowledge_record_id?: number;
  }>(res);
}

// ---------------------------------------------------------------------------
// Staff & Technicians Labor & Money Management API Endpoints
// ---------------------------------------------------------------------------

export async function fetchTechnicians(): Promise<TechniciansSummary> {
  const res = await loggedFetch(`${API_BASE}/technicians`);
  return handleResponse<TechniciansSummary>(res);
}

export async function createTechnician(payload: {
  name: string;
  phone: string;
  role: string;
  hourly_rate: number;
  per_job_rate: number;
  status?: string;
}): Promise<TechnicianStaff> {
  const res = await loggedFetch(`${API_BASE}/technicians`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return handleResponse<TechnicianStaff>(res);
}

export async function updateTechnician(
  techId: number,
  payload: Partial<TechnicianStaff>
): Promise<TechnicianStaff> {
  const res = await loggedFetch(`${API_BASE}/technicians/${techId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return handleResponse<TechnicianStaff>(res);
}

export async function deleteTechnician(techId: number): Promise<{ success: boolean; message: string }> {
  const res = await loggedFetch(`${API_BASE}/technicians/${techId}`, {
    method: 'DELETE',
  });
  return handleResponse<{ success: boolean; message: string }>(res);
}

export async function resolveWorkOrder(
  complaintId: number,
  payload: {
    assigned_technician_id?: number;
    assigned_technician_name?: string;
    labor_cost: number;
    parts_cost: number;
    other_cost?: number;
    notes?: string;
  }
): Promise<{
  success: boolean;
  complaint_id: number;
  status: string;
  work_order_status: string;
  assigned_technician: string;
  labor_cost: number;
  parts_cost: number;
  total_actual_cost: number;
  message: string;
}> {
  const res = await loggedFetch(`${API_BASE}/complaints/${complaintId}/resolve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return handleResponse<any>(res);
}

export async function searchComplaintDossiers(
  query: string
): Promise<{ query: string; count: number; results: ComplaintDossierItem[] }> {
  const params = new URLSearchParams({ q: query });
  const res = await loggedFetch(`${API_BASE}/complaints/search/dossier?${params.toString()}`);
  return handleResponse<{ query: string; count: number; results: ComplaintDossierItem[] }>(res);
}

export async function sendGeminiChatMessage(payload: {
  message: string;
  history?: Array<{ role: string; content: string }>;
  context_complaint_id?: number;
}): Promise<GeminiChatResponse> {
  const res = await loggedFetch(`${API_BASE}/chat/gemini`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return handleResponse<GeminiChatResponse>(res);
}

// ---------------------------------------------------------------------------
// Dynamic Organization & First-Run Onboarding Endpoints
// ---------------------------------------------------------------------------

export async function fetchOrganizationStatus(): Promise<OrganizationStatus> {
  const res = await loggedFetch(`${API_BASE}/organization/status`);
  return handleResponse<OrganizationStatus>(res);
}

export async function setupOrganization(payload: {
  admin_name: string;
  admin_username: string;
  admin_password: string;
  admin_email?: string;
  admin_role?: string;
  admin_phone?: string;
  organization_name: string;
  org_type: string;
  custom_org_type?: string;
  country?: string;
  state?: string;
  city?: string;
  primary_location?: string;
  buildings_count?: number;
  floors_count?: number;
  approx_users_count?: number;
  operating_hours?: string;
  categories?: string[];
  blocks?: string[];
  gemini_api_key?: string;
  load_demo_data?: boolean;
}): Promise<OrganizationProfile> {
  const res = await loggedFetch(`${API_BASE}/organization/setup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return handleResponse<OrganizationProfile>(res);
}

export async function fetchOrganizationSettings(): Promise<OrganizationProfile> {
  const res = await loggedFetch(`${API_BASE}/organization/settings`);
  return handleResponse<OrganizationProfile>(res);
}

export async function updateOrganizationSettings(
  payload: Partial<OrganizationProfile> & {
    admin_username?: string;
    admin_password?: string;
    gemini_api_key?: string;
  }
): Promise<{
  success: boolean;
  message: string;
  organization: OrganizationProfile;
}> {
  const res = await loggedFetch(`${API_BASE}/organization/settings`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return handleResponse<{ success: boolean; message: string; organization: OrganizationProfile }>(res);
}

export async function updateAdminCredentials(payload: {
  admin_name: string;
  admin_username: string;
  admin_password?: string;
}): Promise<{
  success: boolean;
  message: string;
  admin_name: string;
  admin_username: string;
}> {
  const res = await loggedFetch(`${API_BASE}/organization/admin-credentials`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return handleResponse<{
    success: boolean;
    message: string;
    admin_name: string;
    admin_username: string;
  }>(res);
}

export async function fetchSuggestedCategories(orgType: string): Promise<string[]> {
  const res = await loggedFetch(`${API_BASE}/organization/suggested-categories/${encodeURIComponent(orgType)}`);
  const data = await handleResponse<any>(res);
  return Array.isArray(data) ? data : (data.suggested_categories || []);
}

export async function verifyGeminiApiKey(apiKey: string): Promise<ApiKeyVerifyResponse> {
  const res = await loggedFetch(`${API_BASE}/organization/verify-key`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ api_key: apiKey }),
  });
  return handleResponse<ApiKeyVerifyResponse>(res);
}

export async function loadDemoWorkspace(): Promise<{
  success: boolean;
  message: string;
  organization: OrganizationProfile;
  stats: any;
}> {
  const res = await loggedFetch(`${API_BASE}/organization/demo-seed`, {
    method: 'POST',
  });
  return handleResponse<{
    success: boolean;
    message: string;
    organization: OrganizationProfile;
    stats: any;
  }>(res);
}

export async function resetWorkspaceData(confirmation: string = 'CONFIRM_RESET'): Promise<{
  success: boolean;
  message: string;
}> {
  const res = await loggedFetch(`${API_BASE}/organization/reset`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ confirmation }),
  });
  return handleResponse<{ success: boolean; message: string }>(res);
}

// ---------------------------------------------------------------------------
// Equipment Inventory Management Endpoints
// ---------------------------------------------------------------------------

export async function fetchEquipmentList(params?: {
  equipment_type?: string;
  location?: string;
  status?: string;
}): Promise<EquipmentItem[]> {
  const urlParams = new URLSearchParams();
  if (params?.equipment_type) urlParams.append('equipment_type', params.equipment_type);
  if (params?.location) urlParams.append('location', params.location);
  if (params?.status) urlParams.append('status', params.status);

  const res = await loggedFetch(`${API_BASE}/organization/equipment?${urlParams.toString()}`);
  return handleResponse<EquipmentItem[]>(res);
}

export async function createEquipment(payload: {
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
  status?: string;
  criticality?: string;
}): Promise<EquipmentItem> {
  const res = await loggedFetch(`${API_BASE}/organization/equipment`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return handleResponse<EquipmentItem>(res);
}

export async function deleteEquipment(equipmentId: number): Promise<{ success: boolean; message: string }> {
  const res = await loggedFetch(`${API_BASE}/organization/equipment/${equipmentId}`, {
    method: 'DELETE',
  });
  return handleResponse<{ success: boolean; message: string }>(res);
}

export async function importEquipmentCsv(csvContent: string): Promise<{
  success: boolean;
  imported_count: number;
  message: string;
}> {
  const res = await loggedFetch(`${API_BASE}/organization/equipment/import-csv`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ csv_content: csvContent }),
  });
  return handleResponse<{ success: boolean; imported_count: number; message: string }>(res);
}

// ---------------------------------------------------------------------------
// Real-Time Complaint Tracking, Timelines, & Notifications Endpoints
// ---------------------------------------------------------------------------

export async function trackComplaint(trackingCodeOrId: string): Promise<any> {
  const res = await loggedFetch(`${API_BASE}/complaints/track/${encodeURIComponent(trackingCodeOrId)}`);
  return handleResponse<any>(res);
}

export async function fetchUserComplaints(phone: string): Promise<any[]> {
  const res = await loggedFetch(`${API_BASE}/complaints/user/my?phone=${encodeURIComponent(phone)}`);
  return handleResponse<any[]>(res);
}

export async function fetchComplaintTimeline(complaintId: number): Promise<any[]> {
  const res = await loggedFetch(`${API_BASE}/complaints/${complaintId}/timeline`);
  return handleResponse<any[]>(res);
}

export async function resolveComplaintWithNotes(
  complaintId: number,
  payload: {
    resolution_notes: string;
    assigned_technician_id?: number | null;
    assigned_technician_name?: string | null;
    labor_cost?: number;
    parts_cost?: number;
    internal_admin_notes?: string | null;
  }
): Promise<{ success: boolean; complaint_id: number; status: string; message: string }> {
  const res = await loggedFetch(`${API_BASE}/complaints/${complaintId}/resolve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return handleResponse<{ success: boolean; complaint_id: number; status: string; message: string }>(res);
}

export async function reopenComplaint(
  complaintId: number,
  payload: { reason: string; actor_name?: string }
): Promise<{ success: boolean; complaint_id: number; status: string; message: string }> {
  const res = await loggedFetch(`${API_BASE}/complaints/${complaintId}/reopen`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return handleResponse<{ success: boolean; complaint_id: number; status: string; message: string }>(res);
}

export async function fetchNotifications(phone?: string): Promise<any[]> {
  const url = phone
    ? `${API_BASE}/notifications?phone=${encodeURIComponent(phone)}`
    : `${API_BASE}/notifications`;
  const res = await loggedFetch(url);
  return handleResponse<any[]>(res);
}

export async function markNotificationRead(notificationId: number): Promise<{ success: boolean }> {
  const res = await loggedFetch(`${API_BASE}/notifications/${notificationId}/read`, {
    method: 'POST',
  });
  return handleResponse<{ success: boolean }>(res);
}

export async function markAllNotificationsRead(phone?: string): Promise<{ success: boolean }> {
  const url = phone
    ? `${API_BASE}/notifications/mark-all-read?phone=${encodeURIComponent(phone)}`
    : `${API_BASE}/notifications/mark-all-read`;
  const res = await loggedFetch(url, { method: 'POST' });
  return handleResponse<{ success: boolean }>(res);
}

export async function sendUserChatMessage(payload: {
  message: string;
  history?: Array<{ role: string; content: string }>;
  user_phone?: string;
}): Promise<GeminiChatResponse> {
  const res = await loggedFetch(`${API_BASE}/chat/user`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return handleResponse<GeminiChatResponse>(res);
}

export async function sendAdminChatMessage(payload: {
  message: string;
  history?: Array<{ role: string; content: string }>;
}): Promise<GeminiChatResponse> {
  const res = await loggedFetch(`${API_BASE}/chat/admin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return handleResponse<GeminiChatResponse>(res);
}

export async function fetchPublicOrganization(): Promise<OrganizationPublic> {
  const res = await loggedFetch(`${API_BASE}/organization/public`);
  return handleResponse<OrganizationPublic>(res);
}

export async function loginAdmin(payload: { username: string; password: string }): Promise<AdminLoginResponse> {
  const res = await loggedFetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await handleResponse<AdminLoginResponse>(res);
  if (data.access_token) {
    localStorage.setItem('fm_admin_token', data.access_token);
    localStorage.setItem('fm_admin_user', JSON.stringify(data.user));
  }
  return data;
}

export async function fetchCurrentAdmin(): Promise<AdminUser> {
  const res = await loggedFetch(`${API_BASE}/auth/me`);
  return handleResponse<AdminUser>(res);
}

export async function logoutAdmin(): Promise<{ success: boolean }> {
  try {
    const res = await loggedFetch(`${API_BASE}/auth/logout`, {
      method: 'POST',
    });
    localStorage.removeItem('fm_admin_token');
    localStorage.removeItem('fm_admin_user');
    return handleResponse<{ success: boolean }>(res);
  } catch {
    localStorage.removeItem('fm_admin_token');
    localStorage.removeItem('fm_admin_user');
    return { success: true };
  }
}

export async function fetchAnalytics(): Promise<AnalyticsResponse> {
  const res = await loggedFetch(`${API_BASE}/analytics`);
  return handleResponse<AnalyticsResponse>(res);
}



