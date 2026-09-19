import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { App } from '../src/App';
import * as api from '../src/services/api';

describe('FacilityMind AI Platform UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();

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

    vi.spyOn(api, 'fetchEquipmentCategories').mockResolvedValue([
      { type: 'Air Conditioner', count: 65 },
      { type: 'Diesel Generator', count: 35 },
    ]);
  });

  it('renders FacilityMind AI brand logo and tagline', async () => {
    render(<App />);
    const logos = screen.getAllByText(/Facility/i);
    expect(logos.length).toBeGreaterThan(0);
    expect(await screen.findByText(/Autonomous Campus Decision Intelligence/i)).toBeInTheDocument();
  });

  it('renders Command Center Dashboard metrics and charts', async () => {
    render(<App />);
    expect(await screen.findByText('Historical Case Base', {}, { timeout: 5000 })).toBeInTheDocument();
    expect(await screen.findByText('Active Issues / Pipeline')).toBeInTheDocument();
    expect(await screen.findByText('Avg Repair Duration')).toBeInTheDocument();
    expect(await screen.findByText('Total Managed Outlay')).toBeInTheDocument();
  });

  it('allows navigating to File Complaint tab', async () => {
    render(<App />);
    const tabBtns = await screen.findAllByText('File Complaint');
    fireEvent.click(tabBtns[0]);

    expect(await screen.findByText(/ANALYZE WITH FACILITYMIND/i)).toBeInTheDocument();
    expect(screen.getByText(/Quick Load Hackathon Demo Scenarios:/i)).toBeInTheDocument();
  });
});
