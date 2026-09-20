import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { App } from '../src/App';
import * as api from '../src/services/api';

describe('FacilityMind AI Platform UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    localStorage.setItem('fm_admin_token', 'mock-jwt-token-12345');
    localStorage.setItem(
      'fm_admin_user',
      JSON.stringify({
        id: 1,
        username: 'admin',
        full_name: 'Dr. Rajesh Sharma',
        email: 'admin@apex.edu',
        phone: '+91 98765 43210',
        role: 'Facility Director',
      })
    );

    vi.spyOn(api, 'fetchCurrentAdmin').mockResolvedValue({
      id: 1,
      username: 'admin',
      full_name: 'Dr. Rajesh Sharma',
      email: 'admin@apex.edu',
      phone: '+91 98765 43210',
      role: 'Facility Director',
    });

    vi.spyOn(api, 'fetchHealth').mockResolvedValue({
      status: 'ok',
      environment: 'testing',
      version: '0.1.0',
      services: {
        database: 'connected (265 records)',
        vector_store: 'ready (265 vectors indexed)',
        llm_service: 'active (Evidence Fallback Engine)',
        agent_orchestrator: 'ready (LangGraph 6-Node Pipeline)',
        dataset: 'loaded',
        api: 'online',
      },
    });

    vi.spyOn(api, 'fetchNotifications').mockResolvedValue([]);

    vi.spyOn(api, 'fetchDashboardMetrics').mockResolvedValue({
      total_historical_records: 265,
      active_complaints: 4,
      ai_assisted_diagnoses: 12,
      resolved_cases: 261,
      critical_issues_count: 5,
      avg_resolution_time_hours: 1.6,
      total_estimated_cost_inr: 785000,
      urgency_distribution: { Low: 50, Medium: 130, High: 70, Critical: 15 },
      equipment_breakdown: [
        { equipment_type: 'Air Conditioner', count: 65, avg_cost: 2100, total_cost: 136500 },
        { equipment_type: 'Diesel Generator', count: 35, avg_cost: 4800, total_cost: 168000 },
      ],
      location_breakdown: [{ location: 'Computer Lab 3', count: 18 }],
      monthly_trends: [{ month: '2026-03', incidents: 14, cost: 32000 }],
      active_work_orders: [],
    });

    vi.spyOn(api, 'fetchOrganizationStatus').mockResolvedValue({
      setup_completed: true,
      is_fresh_install: false,
      organization: {
        id: 1,
        name: 'Apex Institute of Technology',
        org_type: 'Campus',
        country: 'India',
        state: 'Karnataka',
        city: 'Bengaluru',
        primary_location: 'Main Campus',
        admin_name: 'Dr. Rajesh Sharma',
        admin_role: 'Facility Director',
        buildings_count: 4,
        floors_count: 5,
        approx_users_count: 3000,
        operating_hours: '24/7 Operations',
        categories: ['Air Conditioner', 'Diesel Generator'],
        gemini_api_key_configured: true,
        setup_completed: true,
        created_at: '2026-03-01T00:00:00',
        updated_at: '2026-03-01T00:00:00',
      },
      stats: {
        complaints_count: 4,
        active_complaints_count: 4,
        resolved_complaints_count: 0,
        equipment_count: 10,
        maintenance_records_count: 265,
        technicians_count: 5,
      },
      suggested_categories: ['Air Conditioner', 'Diesel Generator'],
    });

    vi.spyOn(api, 'fetchOrganizationSettings').mockResolvedValue({
      id: 1,
      name: 'Apex Institute of Technology',
      org_type: 'Campus',
      country: 'India',
      state: 'Karnataka',
      city: 'Bengaluru',
      primary_location: 'Main Campus',
      admin_name: 'Dr. Rajesh Sharma',
      admin_email: 'admin@apex.edu',
      admin_role: 'Facility Director',
      admin_phone: '+91 98765 43210',
      buildings_count: 4,
      floors_count: 5,
      approx_users_count: 3000,
      operating_hours: '24/7 Operations',
      categories: ['Air Conditioner', 'Diesel Generator'],
      blocks: [],
      gemini_api_key_configured: true,
      setup_completed: true,
      created_at: '2026-03-01T00:00:00',
      updated_at: '2026-03-01T00:00:00',
    });

    vi.spyOn(api, 'fetchEquipmentCategories').mockResolvedValue([
      { type: 'Air Conditioner', count: 65 },
      { type: 'Diesel Generator', count: 35 },
    ]);
  });

  it('renders FacilityMind AI brand logo and portal switcher', async () => {
    render(<App />);
    const logos = screen.getAllByText(/Facility/i);
    expect(logos.length).toBeGreaterThan(0);
    expect(await screen.findByText(/Campus Infrastructure Support/i)).toBeInTheDocument();
    expect(screen.getByText('Admin Sign In')).toBeInTheDocument();
  });

  it('renders Admin Command Center when switching portal', async () => {
    render(<App />);
    expect(await screen.findByText(/Campus Infrastructure Support/i)).toBeInTheDocument();

    const adminBtn = screen.getByText('Admin Sign In');
    fireEvent.click(adminBtn);

    expect(await screen.findByText(/Command Center & Active Operations/i, {}, { timeout: 5000 })).toBeInTheDocument();
    expect(screen.getByText('Clients / Users')).toBeInTheDocument();
    expect(screen.getByText('Complaints')).toBeInTheDocument();
    expect(screen.getByText('Pending')).toBeInTheDocument();
    expect(screen.getByText('Resolved')).toBeInTheDocument();
  });

  it('allows navigating to File Complaint tab in Admin Mode', async () => {
    render(<App />);
    const adminBtn = await screen.findByText('Admin Sign In');
    fireEvent.click(adminBtn);

    const tabBtns = await screen.findAllByText('File Complaint', {}, { timeout: 5000 });
    fireEvent.click(tabBtns[0]);

    expect(await screen.findByText(/ANALYZE WITH FACILITYMIND/i, {}, { timeout: 5000 })).toBeInTheDocument();
    expect(screen.getByText(/Quick Load Hackathon Demo Scenarios:/i)).toBeInTheDocument();
  });
});

