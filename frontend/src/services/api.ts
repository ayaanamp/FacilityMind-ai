import {
  ComplaintDossierItem,
  DashboardMetrics,
  DecisionReport,
  GeminiChatResponse,
  HealthResponse,
  MaintenanceRecordItem,
  SimilarCase,
  TechnicianFeedbackPayload,
  TechnicianStaff,
  TechniciansSummary,
} from '../types';


const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1';

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
  try {
    const res = await fetch(url, options);
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
      message = errJson.detail || message;
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

