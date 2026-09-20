import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Database,
  ExternalLink,
  IndianRupee,
  Layers,
  MapPin,
  Phone,
  PlusCircle,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
  TrendingUp,
  User,
  UserCheck,
  Users,
  Wallet,
  Wrench,
  X,
  Zap,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Button } from '../components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { ToastContainer, ToastMessage } from '../components/Toast';
import { ResolveWorkOrderModal } from '../components/ResolveWorkOrderModal';
import { GlobalSearchModal } from '../components/GlobalSearchModal';
import {
  batchDeleteComplaints,
  clearAllComplaints,
  deleteComplaint,
  fetchDashboardMetrics,
  hardResetWorkspace,
  searchComplaintDossiers,
  searchSimilarCases,
  updateComplaintStatus,
} from '../services/api';
import { ComplaintDossierItem, DashboardMetrics, SimilarCase, WorkOrderItem } from '../types';

interface DashboardViewProps {
  onNewComplaint: () => void;
  onExploreEvidence: (query?: string, equipment?: string) => void;
  onQuickDemoScenario: () => void;
  onInspectComplaint?: (complaintId: number) => void;
  onSelectSearchForComplaint?: (query: string, equipment?: string, location?: string) => void;
}

const URGENCY_COLORS = {
  Low: '#10b981',      // Emerald
  Medium: '#38bdf8',   // Sky
  High: '#f59e0b',     // Amber
  Critical: '#ef4444', // Red
};

export const DashboardView: React.FC<DashboardViewProps> = ({
  onNewComplaint,
  onExploreEvidence,
  onQuickDemoScenario,
  onInspectComplaint,
  onSelectSearchForComplaint,
}) => {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true);
  const [refreshCounter, setRefreshCounter] = useState<number>(10);
  const [activeWorkOrders, setActiveWorkOrders] = useState<WorkOrderItem[]>([]);
  const [selectedWorkOrderIds, setSelectedWorkOrderIds] = useState<number[]>([]);
  const [isBatchDeleting, setIsBatchDeleting] = useState(false);
  const [isGlobalSearchOpen, setIsGlobalSearchOpen] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Universal Problem & Person Dossier Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SimilarCase[]>([]);
  const [dossierResults, setDossierResults] = useState<ComplaintDossierItem[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  // Work Order Labor Settlement Modal State
  const [resolvingWorkOrder, setResolvingWorkOrder] = useState<WorkOrderItem | null>(null);

  // Clear workspace / Hard Reset confirmation modal
  const [isClearModalOpen, setIsClearModalOpen] = useState(false);
  const [clearMode, setClearMode] = useState<'soft' | 'hard'>('soft');
  const [isClearing, setIsClearing] = useState(false);

  const addToast = (type: ToastMessage['type'], title: string, description?: string) => {
    const id = Date.now().toString();
    setToasts((prev) => [...prev, { id, type, title, description }]);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const loadData = async (_silent = false) => {
    try {
      const data = await fetchDashboardMetrics();
      setMetrics(data);
      if (data.active_work_orders) {
        setActiveWorkOrders(data.active_work_orders);
      }
      setError(null);
    } catch (err: unknown) {
      if (!_silent) {
        // Auto-retry once after 1.5s
        setTimeout(async () => {
          try {
            const retryData = await fetchDashboardMetrics();
            setMetrics(retryData);
            if (retryData.active_work_orders) {
              setActiveWorkOrders(retryData.active_work_orders);
            }
            setError(null);
          } catch {
            setError(err instanceof Error ? err.message : 'Connecting to FacilityMind Backend API...');
          }
        }, 1500);
      }
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Keyboard shortcut for Cmd/Ctrl + K to open Global Search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsGlobalSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Live 10s auto-refresh interval
  useEffect(() => {
    if (!autoRefresh) return;
    const timer = setInterval(() => {
      setRefreshCounter((prev) => {
        if (prev <= 1) {
          loadData(true);
          return 10;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [autoRefresh]);

  // Universal Problem & Person Dossier Instant Search
  const handleUniversalSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setDossierResults([]);
      return;
    }

    setSearchLoading(true);
    try {
      const [dossierRes, casesRes] = await Promise.all([
        searchComplaintDossiers(searchQuery).catch(() => ({ results: [] })),
        searchSimilarCases(searchQuery, undefined, 4).catch(() => []),
      ]);
      setDossierResults(dossierRes.results || []);
      setSearchResults(casesRes || []);
    } catch {
      setSearchResults([]);
      setDossierResults([]);
    } finally {
      setSearchLoading(false);
    }
  };

  const handleAdvanceStage = async (wo: WorkOrderItem) => {
    const stageFlow: Record<string, { next: string; pct: number }> = {
      'Triage Pending': { next: 'Technician Assigned', pct: 45 },
      'Technician Assigned': { next: 'In Repair', pct: 70 },
      'In Repair': { next: 'Quality Audit', pct: 90 },
      'Quality Audit': { next: 'Completed', pct: 100 },
      'Completed': { next: 'Completed', pct: 100 },
    };

    const nextStageInfo = stageFlow[wo.stage] || { next: 'In Repair', pct: 70 };

    try {
      await updateComplaintStatus(wo.complaint_id, {
        work_order_status: nextStageInfo.next,
        status: nextStageInfo.next === 'Completed' ? 'Resolved' : 'In Progress',
      });

      setActiveWorkOrders((prev) =>
        prev.map((item) =>
          item.id === wo.id
            ? { ...item, stage: nextStageInfo.next, progress_percent: nextStageInfo.pct }
            : item
        )
      );

      addToast(
        'success',
        `Work Order ${wo.work_order_code} Advanced`,
        `Transitioned to stage: ${nextStageInfo.next} (${nextStageInfo.pct}%)`
      );
      loadData(true);
    } catch (err: unknown) {
      addToast('error', 'Status Update Failed', err instanceof Error ? err.message : 'Unknown error');
    }
  };

  const handleDeleteWorkOrder = async (wo: WorkOrderItem) => {
    try {
      await deleteComplaint(wo.complaint_id);
      setActiveWorkOrders((prev) => prev.filter((item) => item.id !== wo.id));
      setSelectedWorkOrderIds((prev) => prev.filter((id) => id !== wo.complaint_id));
      addToast('info', `Order ${wo.work_order_code} Removed`, 'Complaint deleted from active register.');
      loadData(true);
    } catch (err: unknown) {
      addToast('error', 'Delete Failed', err instanceof Error ? err.message : 'Unknown error');
    }
  };

  const handleToggleSelectWorkOrder = (complaintId: number) => {
    setSelectedWorkOrderIds((prev) =>
      prev.includes(complaintId) ? prev.filter((id) => id !== complaintId) : [...prev, complaintId]
    );
  };

  const handleSelectAllWorkOrders = () => {
    if (selectedWorkOrderIds.length === activeWorkOrders.length) {
      setSelectedWorkOrderIds([]);
    } else {
      setSelectedWorkOrderIds(activeWorkOrders.map((wo) => wo.complaint_id));
    }
  };

  const handleBatchDelete = async () => {
    if (selectedWorkOrderIds.length === 0) return;
    setIsBatchDeleting(true);
    try {
      const res = await batchDeleteComplaints(selectedWorkOrderIds);
      addToast('success', 'Batch Delete Complete', res.message);
      setSelectedWorkOrderIds([]);
      await loadData();
    } catch (err: unknown) {
      addToast('error', 'Batch Delete Failed', err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setIsBatchDeleting(false);
    }
  };

  const handleExecuteClear = async () => {
    setIsClearing(true);
    try {
      if (clearMode === 'hard') {
        const res = await hardResetWorkspace();
        addToast('success', 'Hard Factory Reset Complete', `${res.message} Next complaint will start from serial #1 (WO-0001).`);
      } else {
        const res = await clearAllComplaints();
        addToast('success', 'Workspace Cleaned', res.message);
      }
      setIsClearModalOpen(false);
      setActiveWorkOrders([]);
      setSelectedWorkOrderIds([]);
      await loadData();
    } catch (err: unknown) {
      addToast('error', 'Reset Failed', err instanceof Error ? err.message : 'Failed to clear database');
    } finally {
      setIsClearing(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-in fade-in duration-300 pb-16 font-sans">
      <ToastContainer toasts={toasts} onDismiss={removeToast} />

      {/* Top Header & Command Center Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-850 pb-5">
        <div>
          <div className="flex items-center gap-2 text-zinc-400 text-xs font-mono uppercase tracking-wider mb-1.5">
            <Layers className="h-4 w-4 text-zinc-300" />
            <span>Campus Infrastructure Intelligence Engine</span>
            <span className="text-[10px] px-2 py-0.5 rounded bg-zinc-900 border border-zinc-700 text-zinc-300">
              Live Telemetry
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white font-mono">
            Command Center &amp; Active Operations
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Real-time agentic triage, multi-stage work orders, and historical case precedents across campus infrastructure.
          </p>
        </div>

        {/* Global Action Toolbar */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Global Multi-Index Search Trigger */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsGlobalSearchOpen(true)}
            className="border-zinc-800 hover:border-zinc-600 bg-zinc-900 text-zinc-200 text-xs font-sans flex items-center gap-1.5 active:scale-[0.98] transition-all px-3 py-1.5"
            title="Search across all complaints, names, contact numbers, and equipment (Shortcut: Ctrl+K)"
          >
            <Search className="h-3.5 w-3.5 text-emerald-400" />
            <span>Search System</span>
            <kbd className="hidden sm:inline-block ml-1 px-1.5 py-0.5 text-[10px] rounded bg-zinc-800 border border-zinc-700 text-zinc-300 font-mono">
              Ctrl+K
            </kbd>
          </Button>

          {/* Auto Refresh Toggle */}
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-mono transition-all ${
              autoRefresh
                ? 'border-emerald-700 bg-emerald-950/50 text-emerald-300'
                : 'border-zinc-800 bg-zinc-900 text-zinc-400'
            }`}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${autoRefresh ? 'animate-spin text-emerald-400' : ''}`} />
            <span>{autoRefresh ? `Live Sync (${refreshCounter}s)` : 'Sync Paused'}</span>
          </button>

          {/* Clear Workspace / Reset to 0 Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setClearMode('soft');
              setIsClearModalOpen(true);
            }}
            className="border-zinc-800 hover:border-red-800 bg-zinc-950 hover:bg-red-950/30 text-zinc-400 hover:text-red-300 text-xs font-sans flex items-center gap-1.5"
            title="Wipe active test complaints or perform hard factory reset to serial #1"
          >
            <Trash2 className="h-3.5 w-3.5 text-zinc-400" />
            <span>Reset Workspace</span>
          </Button>

          {/* Quick Demo Scenarios */}
          <Button
            variant="outline"
            size="sm"
            onClick={onQuickDemoScenario}
            className="border-emerald-800/60 bg-emerald-950/30 hover:bg-emerald-900/40 text-emerald-300 text-xs font-sans flex items-center gap-1.5"
          >
            <Sparkles className="h-3.5 w-3.5 text-emerald-400" />
            <span>Demo Scenarios</span>
          </Button>

          {/* Submit New Complaint Button */}
          <Button
            size="sm"
            onClick={onNewComplaint}
            className="bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-sans font-bold px-4 py-1.5 flex items-center gap-1.5 shadow-md shadow-emerald-500/20 active:scale-95 transition-all"
          >
            <PlusCircle className="h-4 w-4" />
            <span>+ Report Breakdown</span>
          </Button>
        </div>
      </div>

      {/* Beginner-Friendly Quick Start: 3-Step Agentic Architecture Guide */}
      <div className="rounded-xl border border-emerald-900/50 bg-gradient-to-r from-emerald-950/40 via-zinc-950 to-sky-950/30 p-5 shadow-lg space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-800/80 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="h-7 w-7 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white font-sans">How FacilityMind Works in 3 Easy Steps</h3>
              <p className="text-[11px] text-zinc-400">Autonomous multi-agent infrastructure maintenance workflow for campus facilities</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onNewComplaint}
              className="text-xs font-bold text-black bg-white hover:bg-zinc-200 px-3 py-1.5 rounded-lg active:scale-95 transition-all flex items-center gap-1.5 shadow-sm"
            >
              <PlusCircle className="h-3.5 w-3.5 text-black" />
              <span>File Complaint Now</span>
            </button>
            <button
              onClick={onQuickDemoScenario}
              className="text-xs font-medium text-emerald-300 bg-emerald-950 border border-emerald-700 hover:bg-emerald-900 px-3 py-1.5 rounded-lg active:scale-95 transition-all flex items-center gap-1.5"
            >
              <Zap className="h-3.5 w-3.5 text-emerald-400" />
              <span>1-Click Demo</span>
            </button>
          </div>
        </div>

        {/* 3 Step Visual Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          <div className="p-3.5 rounded-lg bg-zinc-900/70 border border-zinc-800 space-y-1.5 hover:border-emerald-700/60 transition-all">
            <div className="flex items-center gap-2 text-emerald-400 font-bold font-mono text-[11px]">
              <span className="h-5 w-5 rounded-full bg-emerald-950 border border-emerald-800 flex items-center justify-center">1</span>
              <span>1. Report What's Broken</span>
            </div>
            <p className="text-zinc-300 text-[11px] leading-relaxed">
              Describe the issue in simple language (e.g. &ldquo;AC not cooling in Lab 3&rdquo;). No technical jargon needed.
            </p>
          </div>

          <div className="p-3.5 rounded-lg bg-zinc-900/70 border border-zinc-800 space-y-1.5 hover:border-sky-700/60 transition-all">
            <div className="flex items-center gap-2 text-sky-400 font-bold font-mono text-[11px]">
              <span className="h-5 w-5 rounded-full bg-sky-950 border border-sky-800 flex items-center justify-center">2</span>
              <span>2. 6 AI Agents Diagnose</span>
            </div>
            <p className="text-zinc-300 text-[11px] leading-relaxed">
              Autonomous agents search 265+ historical records, determine exact root cause, and forecast parts &amp; ₹ costs.
            </p>
          </div>

          <div className="p-3.5 rounded-lg bg-zinc-900/70 border border-zinc-800 space-y-1.5 hover:border-purple-700/60 transition-all">
            <div className="flex items-center gap-2 text-purple-400 font-bold font-mono text-[11px]">
              <span className="h-5 w-5 rounded-full bg-purple-950 border border-purple-800 flex items-center justify-center">3</span>
              <span>3. Dispatch &amp; Settle Labor</span>
            </div>
            <p className="text-zinc-300 text-[11px] leading-relaxed">
              Assigned technician follows step-by-step repair steps. Settle labor wages and verify completion in real-time.
            </p>
          </div>
        </div>
      </div>

      {/* Universal Problem, Person & Keyword Search Bar */}
      <Card className="border-zinc-800 bg-zinc-950/90 shadow-sm">
        <CardContent className="p-4 space-y-3">
          <form onSubmit={handleUniversalSearch} className="flex flex-col sm:flex-row gap-2.5">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search ANY person name (e.g. 'Prof. Sharma'), phone number, classroom, equipment, or symptom..."
                className="w-full rounded-md border border-zinc-800 bg-black pl-9 pr-3 py-2 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500 font-mono"
              />
            </div>
            <Button
              type="submit"
              disabled={searchLoading}
              className="bg-zinc-900 hover:bg-zinc-800 text-white border border-zinc-700 text-xs font-mono px-4 shrink-0 flex items-center gap-1.5 active:scale-[0.98] transition-all"
            >
              {searchLoading ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
              <span>Universal Search</span>
            </Button>
          </form>

          {/* Section 1: Live Registered Complaints & Reporter Dossiers */}
          {dossierResults.length > 0 && (
            <div className="p-3.5 rounded-lg bg-black border border-emerald-900/60 space-y-2.5 animate-in fade-in duration-200">
              <div className="flex items-center justify-between text-xs font-mono text-emerald-400 border-b border-zinc-850 pb-2">
                <span className="flex items-center gap-1.5 font-bold">
                  <UserCheck className="h-4 w-4 text-emerald-400" />
                  Found {dossierResults.length} Live Complaint Dossiers for &ldquo;{searchQuery}&rdquo;:
                </span>
                <button
                  onClick={() => setDossierResults([])}
                  className="text-zinc-500 hover:text-white p-0.5 rounded"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {dossierResults.map((dos) => (
                  <div
                    key={dos.id}
                    className="p-3 rounded-lg bg-zinc-900/80 border border-zinc-750 hover:border-emerald-700/80 transition-all space-y-2.5 text-xs font-mono"
                  >
                    {/* Header: Code & Urgency */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-bold px-2 py-0.5 rounded bg-zinc-800 text-white border border-zinc-700 text-[11px]">
                          {dos.work_order_code}
                        </span>
                        <span className="font-semibold text-white">{dos.equipment_type}</span>
                      </div>
                      <Badge
                        className={
                          dos.status === 'Resolved' || dos.work_order_status === 'Completed'
                            ? 'bg-emerald-950 text-emerald-400 border-emerald-800 text-[10px]'
                            : 'bg-amber-950 text-amber-400 border-amber-800 text-[10px]'
                        }
                      >
                        ● {dos.work_order_status || dos.status}
                      </Badge>
                    </div>

                    {/* Person Details Card */}
                    <div className="p-2 rounded bg-black/60 border border-zinc-800/80 space-y-1 text-[11px] text-zinc-300">
                      <div className="flex items-center justify-between">
                        <span className="text-white font-bold flex items-center gap-1">
                          <User className="h-3 w-3 text-emerald-400" />
                          {dos.reporter_name}
                        </span>
                        {dos.reporter_phone && (
                          <span className="text-zinc-400 flex items-center gap-1">
                            <Phone className="h-3 w-3 text-emerald-400" />
                            {dos.reporter_phone}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between text-zinc-400 text-[10px]">
                        <span>Room: <strong className="text-zinc-200">{dos.location}</strong></span>
                        <span>Dept: <strong className="text-zinc-200">{dos.reporter_dept}</strong></span>
                      </div>
                      <div className="text-[10px] text-zinc-500">
                        Observed: {dos.noticed_at} &bull; Created: {dos.created_at}
                      </div>
                    </div>

                    {/* Complaint & AI Diagnosis */}
                    <div className="space-y-1 text-[11px]">
                      <p className="text-zinc-300">
                        <span className="text-zinc-500">Issue: </span>
                        &ldquo;{dos.symptoms}&rdquo;
                      </p>
                      <p className="text-emerald-300/90 text-[10px]">
                        <span className="text-zinc-500 font-semibold">Diagnosis: </span>
                        {dos.primary_cause}
                      </p>
                    </div>

                    {/* Technician & Financials */}
                    <div className="flex items-center justify-between pt-2 border-t border-zinc-800 text-[10px] text-zinc-400">
                      <div>
                        {dos.assigned_technician_name ? (
                          <span className="text-emerald-400 font-semibold">
                            Tech: {dos.assigned_technician_name} (₹{dos.labor_cost} labor)
                          </span>
                        ) : (
                          <span>Est Outlay: ₹{dos.estimated_cost}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {onInspectComplaint && (
                          <button
                            onClick={() => onInspectComplaint(dos.id)}
                            className="text-white hover:text-zinc-300 underline"
                          >
                            Inspect Report &rarr;
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section 2: Quick Historical Precedents Matches */}
          {searchResults.length > 0 && (
            <div className="p-3 rounded-md bg-black border border-zinc-850 space-y-2 animate-in fade-in duration-200">
              <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400">
                <span className="flex items-center gap-1.5">
                  <Database className="h-3 w-3 text-zinc-300" />
                  Found {searchResults.length} verified historical solutions in Knowledge Base:
                </span>
                <button onClick={() => setSearchResults([])} className="text-zinc-500 hover:text-white">
                  <X className="h-3 w-3" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {searchResults.map((sr) => (
                  <div
                    key={sr.case_id}
                    className="p-2.5 rounded bg-zinc-900/60 border border-zinc-800 hover:border-zinc-600 transition-all flex flex-col justify-between text-xs font-sans"
                  >
                    <div>
                      <div className="flex items-center justify-between font-mono text-[11px] mb-1">
                        <span className="font-bold text-zinc-200">{sr.equipment_type}</span>
                        <span className="text-emerald-400">{sr.similarity_percentage}% Match</span>
                      </div>
                      <p className="text-zinc-300 text-[11px] font-mono line-clamp-1 mb-1">
                        &ldquo;{sr.complaint}&rdquo;
                      </p>
                      <p className="text-zinc-400 text-[10px] leading-tight">
                        <span className="text-zinc-500">Fix:</span> {sr.recommended_fix}
                      </p>
                    </div>

                    <div className="flex items-center justify-between pt-2 mt-2 border-t border-zinc-800/60 text-[10px] font-mono">
                      <span className="text-zinc-400">₹{sr.estimated_cost} &bull; {sr.repair_time}h</span>
                      {onSelectSearchForComplaint && (
                        <button
                          onClick={() => onSelectSearchForComplaint(sr.complaint, sr.equipment_type, sr.location)}
                          className="text-white hover:text-zinc-300 flex items-center gap-1 underline active:scale-95 transition-all"
                        >
                          <span>Analyze with AI</span>
                          <ArrowRight className="h-2.5 w-2.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Error state banner */}
      {error && (
        <div className="p-4 rounded-lg bg-red-950/30 border border-red-900/50 text-red-300 text-xs flex items-center justify-between">
          <span>{error}</span>
          <Button size="sm" variant="outline" onClick={() => loadData()} className="text-xs">
            Retry
          </Button>
        </div>
      )}

      {/* Comprehensive 8-Card Live Platform KPI Telemetry Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        {/* Card 1: Registered Clients / Users */}
        <Card className="border-zinc-800 bg-zinc-950/70 hover:border-zinc-700 transition-all">
          <CardContent className="p-3.5 space-y-1">
            <div className="flex items-center justify-between text-zinc-400">
              <span className="text-[10px] font-mono uppercase tracking-wider">Clients / Users</span>
              <Users className="h-3.5 w-3.5 text-sky-400" />
            </div>
            <div className="text-xl font-bold font-mono text-white">
              {metrics ? (metrics.total_users_count || 0).toLocaleString() : '—'}
            </div>
            <p className="text-[9px] text-zinc-400 truncate">Campus Complainants</p>
          </CardContent>
        </Card>

        {/* Card 2: Total Complaints */}
        <Card className="border-zinc-800 bg-zinc-950/70 hover:border-zinc-700 transition-all">
          <CardContent className="p-3.5 space-y-1">
            <div className="flex items-center justify-between text-zinc-400">
              <span className="text-[10px] font-mono uppercase tracking-wider">Complaints</span>
              <Layers className="h-3.5 w-3.5 text-indigo-400" />
            </div>
            <div className="text-xl font-bold font-mono text-white">
              {metrics ? (metrics.total_complaints_count ?? metrics.total_historical_records).toLocaleString() : '—'}
            </div>
            <p className="text-[9px] text-zinc-400 truncate">Total Registered</p>
          </CardContent>
        </Card>

        {/* Card 3: Critical Issues */}
        <Card className="border-zinc-800 bg-zinc-950/70 hover:border-zinc-700 transition-all">
          <CardContent className="p-3.5 space-y-1">
            <div className="flex items-center justify-between text-zinc-400">
              <span className="text-[10px] font-mono uppercase tracking-wider">Critical</span>
              <AlertTriangle className="h-3.5 w-3.5 text-red-400" />
            </div>
            <div className="text-xl font-bold font-mono text-white">
              {metrics ? (metrics.critical_issues_count || 0).toLocaleString() : '—'}
            </div>
            <p className="text-[9px] text-red-400/80 truncate">High Severity SLA</p>
          </CardContent>
        </Card>

        {/* Card 4: Pending Pipeline */}
        <Card className="border-zinc-800 bg-zinc-950/70 hover:border-zinc-700 transition-all">
          <CardContent className="p-3.5 space-y-1">
            <div className="flex items-center justify-between text-zinc-400">
              <span className="text-[10px] font-mono uppercase tracking-wider">Pending</span>
              <Clock className="h-3.5 w-3.5 text-amber-400" />
            </div>
            <div className="text-xl font-bold font-mono text-white">
              {metrics ? (metrics.active_complaints ?? activeWorkOrders.length) : '—'}
            </div>
            <p className="text-[9px] text-amber-400/80 truncate">In Triage / Repair</p>
          </CardContent>
        </Card>

        {/* Card 5: Resolved Cases */}
        <Card className="border-zinc-800 bg-zinc-950/70 hover:border-zinc-700 transition-all">
          <CardContent className="p-3.5 space-y-1">
            <div className="flex items-center justify-between text-zinc-400">
              <span className="text-[10px] font-mono uppercase tracking-wider">Resolved</span>
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
            </div>
            <div className="text-xl font-bold font-mono text-white">
              {metrics ? (metrics.resolved_cases || 0).toLocaleString() : '—'}
            </div>
            <p className="text-[9px] text-emerald-400/80 truncate">Verified &amp; Closed</p>
          </CardContent>
        </Card>

        {/* Card 6: Workers / Technicians */}
        <Card className="border-zinc-800 bg-zinc-950/70 hover:border-zinc-700 transition-all">
          <CardContent className="p-3.5 space-y-1">
            <div className="flex items-center justify-between text-zinc-400">
              <span className="text-[10px] font-mono uppercase tracking-wider">Workers</span>
              <Wrench className="h-3.5 w-3.5 text-purple-400" />
            </div>
            <div className="text-xl font-bold font-mono text-white">
              {metrics ? (metrics.total_technicians_count || 0) : '—'}
            </div>
            <p className="text-[9px] text-zinc-400 truncate">Field Tech Roster</p>
          </CardContent>
        </Card>

        {/* Card 7: Assets / Equipment */}
        <Card className="border-zinc-800 bg-zinc-950/70 hover:border-zinc-700 transition-all">
          <CardContent className="p-3.5 space-y-1">
            <div className="flex items-center justify-between text-zinc-400">
              <span className="text-[10px] font-mono uppercase tracking-wider">Assets</span>
              <Database className="h-3.5 w-3.5 text-cyan-400" />
            </div>
            <div className="text-xl font-bold font-mono text-white">
              {metrics ? (metrics.total_equipment_count || metrics.equipment_breakdown?.length || 0) : '—'}
            </div>
            <p className="text-[9px] text-zinc-400 truncate">Inventory Units</p>
          </CardContent>
        </Card>

        {/* Card 8: Expenses / Financials */}
        <Card className="border-zinc-800 bg-zinc-950/70 hover:border-zinc-700 transition-all">
          <CardContent className="p-3.5 space-y-1">
            <div className="flex items-center justify-between text-zinc-400">
              <span className="text-[10px] font-mono uppercase tracking-wider">Expenses</span>
              <IndianRupee className="h-3.5 w-3.5 text-emerald-400" />
            </div>
            <div className="text-xl font-bold font-mono text-white">
              ₹{metrics ? ((metrics.total_expenses_inr || metrics.total_estimated_cost_inr || 0) >= 100000 ? `${((metrics.total_expenses_inr || metrics.total_estimated_cost_inr || 0) / 100000).toFixed(1)}L` : `${((metrics.total_expenses_inr || metrics.total_estimated_cost_inr || 0) / 1000).toFixed(1)}k`) : '—'}
            </div>
            <p className="text-[9px] text-zinc-400 truncate">Managed Outlay</p>
          </CardContent>
        </Card>
      </div>

      {/* Active Work Orders Visual Progress Tracker */}
      <Card className="border-zinc-800 bg-zinc-950/80 shadow-md">
        <CardHeader className="pb-3 border-b border-zinc-850 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <CardTitle className="text-sm font-mono font-bold text-white flex items-center gap-2">
              <Wrench className="h-4 w-4 text-zinc-300" />
              Active Work Orders Progress Tracker
            </CardTitle>
            <CardDescription className="text-xs text-zinc-400 mt-0.5">
              Multi-stage execution pipeline initiated by FacilityMind agents: Triage Pending &rarr; Technician Assigned &rarr; In Repair &rarr; Quality Audit &rarr; Completed
            </CardDescription>
          </div>
          
          <div className="flex items-center gap-2">
            {activeWorkOrders.length > 0 && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleSelectAllWorkOrders}
                  className="h-7 text-[11px] font-mono border-zinc-800 bg-zinc-900 text-zinc-300 hover:text-white"
                >
                  {selectedWorkOrderIds.length === activeWorkOrders.length ? 'Deselect All' : 'Select All'}
                </Button>

                {selectedWorkOrderIds.length > 0 && (
                  <Button
                    size="sm"
                    onClick={handleBatchDelete}
                    disabled={isBatchDeleting}
                    className="h-7 text-[11px] font-mono bg-red-950 hover:bg-red-900 text-red-300 border border-red-800 font-semibold flex items-center gap-1.5 active:scale-95 transition-all"
                  >
                    <Trash2 className="h-3 w-3" />
                    <span>{isBatchDeleting ? 'Deleting...' : `Delete Selected (${selectedWorkOrderIds.length})`}</span>
                  </Button>
                )}
              </>
            )}
            <Badge className="bg-zinc-900 text-zinc-300 border-zinc-700 font-mono text-xs">
              {activeWorkOrders.length} Tracked Issues
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="p-4">
          {activeWorkOrders.length === 0 ? (
            <div className="py-10 text-center space-y-3">
              <div className="h-10 w-10 mx-auto rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400">
                <CheckCircle2 className="h-5 w-5 text-emerald-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white font-mono">
                  No Active Work Orders (Workspace is Clean)
                </p>
                <p className="text-xs text-zinc-400 max-w-md mx-auto mt-1 font-mono">
                  All previous issues have been resolved or cleared. Submit a new complaint or select a demo scenario to see agents in action.
                </p>
              </div>
              <div className="flex items-center justify-center gap-3 pt-2">
                <Button size="sm" onClick={onNewComplaint} className="bg-white text-black font-mono text-xs">
                  + Submit New Complaint
                </Button>
                <Button size="sm" variant="outline" onClick={onQuickDemoScenario} className="border-zinc-800 text-zinc-300 font-mono text-xs">
                  Load Demo Scenario
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {activeWorkOrders.map((wo) => {
                const stages = ['Triage Pending', 'Technician Assigned', 'In Repair', 'Quality Audit', 'Completed'];
                const currentStageIdx = stages.indexOf(wo.stage) !== -1 ? stages.indexOf(wo.stage) : 1;
                const isSelected = selectedWorkOrderIds.includes(wo.complaint_id);

                return (
                  <div
                    key={wo.id}
                    className={`p-4 rounded-lg bg-black/60 border space-y-3 transition-all font-sans ${
                      isSelected ? 'border-red-900/80 bg-red-950/10' : 'border-zinc-800/80 hover:border-zinc-700'
                    }`}
                  >
                    {/* Header Row */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelectWorkOrder(wo.complaint_id)}
                          className="h-4 w-4 rounded border-zinc-700 bg-zinc-900 text-white focus:ring-0 focus:ring-offset-0 cursor-pointer accent-white"
                          title="Select work order for batch operations"
                        />
                        <span className="font-mono font-bold text-xs px-2 py-0.5 rounded bg-zinc-900 text-white border border-zinc-750">
                          {wo.work_order_code}
                        </span>
                        <h4 className="font-bold text-white text-xs font-mono">
                          {wo.equipment_type} &bull; <span className="text-zinc-400 font-normal">{wo.location}</span>
                        </h4>
                        <span
                          className={`text-[10px] font-mono px-2 py-0.5 rounded ${
                            wo.urgency === 'Critical'
                              ? 'bg-red-950 text-red-400 border border-red-800'
                              : wo.urgency === 'High'
                              ? 'bg-amber-950 text-amber-400 border border-amber-800'
                              : 'bg-zinc-900 text-zinc-300 border border-zinc-750'
                          }`}
                        >
                          {wo.urgency}
                        </span>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-2">
                        {onInspectComplaint && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => onInspectComplaint(wo.complaint_id)}
                            className="h-7 text-[11px] font-mono border-zinc-800 bg-zinc-900 text-zinc-300 hover:text-white active:scale-95 transition-all"
                          >
                            Inspect AI Decision
                          </Button>
                        )}
                        {wo.stage !== 'Completed' ? (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleAdvanceStage(wo)}
                              className="h-7 text-[11px] font-mono border-zinc-750 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 active:scale-95 transition-all"
                            >
                              Advance Stage &rarr;
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => setResolvingWorkOrder(wo)}
                              className="h-7 text-[11px] font-mono bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center gap-1 active:scale-95 transition-all"
                            >
                              <CheckCircle2 className="h-3 w-3" />
                              <span>Resolve &amp; Settle Labor</span>
                            </Button>
                          </>
                        ) : (
                          <div className="flex items-center gap-1.5 text-[10px] font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-800 px-2 py-1 rounded">
                            <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                            <span>
                              {wo.assigned_technician_name
                                ? `Settled (${wo.assigned_technician_name} &bull; ₹${wo.labor_cost})`
                                : 'Verified & Completed'}
                            </span>
                          </div>
                        )}
                        <button
                          onClick={() => handleDeleteWorkOrder(wo)}
                          title="Delete / Cancel Order"
                          className="text-zinc-500 hover:text-red-400 p-1 rounded hover:bg-zinc-900 transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Reported Symptoms & Reporter */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs text-zinc-400 bg-zinc-950/70 p-2.5 rounded border border-zinc-850 gap-2 font-mono">
                      <div className="truncate max-w-xl">
                        <span className="text-zinc-500">Symptom: </span>
                        <span className="text-zinc-200">"{wo.symptoms}"</span>
                      </div>
                      <div className="shrink-0 text-[11px] text-zinc-400">
                        <span>Reporter: {wo.reporter_name} ({wo.reporter_dept})</span>
                      </div>
                    </div>

                    {/* Multi-Stage Visual Pipeline */}
                    <div className="space-y-2 pt-1">
                      <div className="grid grid-cols-5 gap-1 text-center font-mono text-[10px]">
                        {stages.map((stageName, idx) => {
                          const isDone = idx < currentStageIdx;
                          const isCurrent = idx === currentStageIdx;
                          return (
                            <div
                              key={stageName}
                              className={`p-1.5 rounded transition-all ${
                                isCurrent
                                  ? 'bg-white text-black font-bold border border-white'
                                  : isDone
                                  ? 'bg-zinc-900 text-emerald-400 border border-emerald-900/60'
                                  : 'bg-zinc-950 text-zinc-600 border border-zinc-850'
                              }`}
                            >
                              <div className="flex items-center justify-center gap-1">
                                {isDone && <CheckCircle2 className="h-2.5 w-2.5 text-emerald-400" />}
                                <span>{stageName}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Progress bar line */}
                      <div className="h-1.5 w-full bg-zinc-900 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-white transition-all duration-500 rounded-full"
                          style={{ width: `${wo.progress_percent}%` }}
                        />
                      </div>
                    </div>

                    {/* Operational Details Strip */}
                    <div className="flex flex-wrap items-center justify-between text-[11px] text-zinc-500 pt-1 font-mono border-t border-zinc-850/60">
                      <span>Assigned Trade: <strong className="text-zinc-300">{wo.technician_required}</strong></span>
                      <span>Est Cost: <strong className="text-zinc-300">₹{wo.estimated_cost}</strong></span>
                      <span>Est Downtime: <strong className="text-zinc-300">{wo.repair_time_hours} Hours</strong></span>
                      <span>Noticed At: <strong className="text-zinc-400">{wo.noticed_at}</strong></span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Predictive AI Alerts & Equipment Wear-and-Tear Forecast */}
      <Card className="border-zinc-800 bg-zinc-950/80 shadow-md">
        <CardHeader className="pb-3 border-b border-zinc-850 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-sm font-mono font-bold text-white flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-emerald-400" />
              Predictive AI Maintenance &amp; Wear-and-Tear Forecast
            </CardTitle>
            <CardDescription className="text-xs text-zinc-400 mt-0.5">
              Machine learning wear-and-tear models analyzing run-hours, telemetry cycles, and MTBF to flag imminent breakdowns before outage occurs.
            </CardDescription>
          </div>
          <Badge className="bg-emerald-950 text-emerald-300 border-emerald-800 font-mono text-xs">
            {metrics?.predictive_alerts?.length || 0} Forecasted Assets
          </Badge>
        </CardHeader>

        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {metrics?.predictive_alerts?.map((alert) => (
              <div
                key={alert.id}
                className="p-3.5 rounded-lg bg-black/60 border border-zinc-850 hover:border-zinc-700 transition-all space-y-3 font-mono text-xs flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="font-bold text-white text-xs">{alert.equipment_type}</h4>
                      <p className="text-[11px] text-zinc-400 flex items-center gap-1 mt-0.5">
                        <MapPin className="h-3 w-3 text-zinc-500" />
                        {alert.location_hotspot}
                      </p>
                    </div>
                    <Badge
                      className={`text-[10px] font-mono shrink-0 ${
                        alert.risk_level.toLowerCase().includes('critical')
                          ? 'bg-red-950 text-red-400 border-red-800'
                          : alert.risk_level.toLowerCase().includes('high')
                          ? 'bg-amber-950 text-amber-400 border-amber-800'
                          : alert.risk_level.toLowerCase().includes('moderate')
                          ? 'bg-yellow-950 text-yellow-400 border-yellow-800'
                          : 'bg-zinc-900 text-zinc-300 border-zinc-750'
                      }`}
                    >
                      {alert.risk_level}
                    </Badge>
                  </div>

                  {/* Wear & Tear Progress Bar */}
                  <div className="mt-3 space-y-1">
                    <div className="flex justify-between text-[10px] text-zinc-400 font-mono">
                      <span>Wear Degradation Score</span>
                      <span className="font-bold text-white">{alert.wear_index_pct}%</span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-zinc-900 overflow-hidden border border-zinc-800">
                      <div
                        className={`h-full rounded-full ${
                          alert.wear_index_pct > 80
                            ? 'bg-red-500'
                            : alert.wear_index_pct > 65
                            ? 'bg-amber-500'
                            : 'bg-emerald-500'
                        }`}
                        style={{ width: `${alert.wear_index_pct}%` }}
                      />
                    </div>
                  </div>

                  {/* Failure Mode & Recommendation */}
                  <div className="mt-3 p-2 rounded bg-zinc-900/60 border border-zinc-850/80 space-y-1 text-[11px]">
                    <div className="text-zinc-300">
                      <span className="text-zinc-500">Predicted Mode: </span>
                      {alert.predicted_failure_mode}
                    </div>
                    <div className="text-emerald-400">
                      <span className="text-zinc-500">Preventive Action: </span>
                      {alert.recommended_action}
                    </div>
                  </div>
                </div>

                {/* Metrics Footer & Dispatch Button */}
                <div className="pt-2 border-t border-zinc-850 flex items-center justify-between gap-2">
                  <div className="text-[10px] text-zinc-400 space-y-0.5">
                    <div>Est Cost: <strong className="text-white">₹{alert.estimated_preventive_cost}</strong></div>
                    <div>MTBF Forecast: <strong className="text-zinc-300">{alert.mean_time_between_failures_days} days</strong> ({alert.historical_incident_count} past events)</div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      if (onSelectSearchForComplaint) {
                        onSelectSearchForComplaint(alert.predicted_failure_mode, alert.equipment_type, alert.location_hotspot);
                      } else {
                        onNewComplaint();
                      }
                    }}
                    className="h-7 text-[10px] font-mono border-zinc-750 bg-zinc-900 hover:bg-zinc-800 text-white active:scale-95 transition-all flex items-center gap-1"
                  >
                    <span>Dispatch Inspection</span>
                    <ArrowRight className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Analytics Charts Grid (100% synchronized with database) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Equipment Category Breakdown Bar Chart */}
        <Card className="lg:col-span-2 border-zinc-800 bg-zinc-950/70">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-sm font-mono font-bold text-white flex items-center gap-2">
                <Database className="h-4 w-4 text-zinc-300" />
                Infrastructure Asset Distribution
              </CardTitle>
              <CardDescription className="text-xs text-zinc-400">
                Click any equipment bar to filter historical precedents in Evidence Explorer
              </CardDescription>
            </div>
            <span className="text-[10px] font-mono text-zinc-400 border border-zinc-800 px-2 py-0.5 rounded bg-zinc-900">
              Interactive Drilldown
            </span>
          </CardHeader>
          <CardContent className="pt-4">
            {metrics?.equipment_breakdown && metrics.equipment_breakdown.length > 0 ? (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={metrics.equipment_breakdown.slice(0, 8)}
                    margin={{ top: 10, right: 10, left: -10, bottom: 20 }}
                    onClick={(state) => {
                      if (state && state.activeLabel !== undefined && state.activeLabel !== null) {
                        onExploreEvidence('', String(state.activeLabel));
                      }
                    }}
                    className="cursor-pointer"
                  >
                    <CartesianGrid strokeDasharray="2 2" stroke="#27272a" opacity={0.6} />
                    <XAxis
                      dataKey="equipment_type"
                      tick={{ fill: '#a1a1aa', fontSize: 10, fontFamily: 'monospace' }}
                      interval={0}
                      angle={-15}
                      textAnchor="end"
                    />
                    <YAxis tick={{ fill: '#a1a1aa', fontSize: 11, fontFamily: 'monospace' }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#09090b',
                        borderColor: '#27272a',
                        borderRadius: '8px',
                        fontSize: '11px',
                        fontFamily: 'monospace',
                        color: '#ffffff',
                      }}
                    />
                    <Bar dataKey="count" fill="#f4f4f5" radius={[4, 4, 0, 0]} name="Total Incidents" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-64 flex flex-col items-center justify-center text-center p-6 text-zinc-500 font-mono text-xs border border-dashed border-zinc-850 rounded-lg">
                <Database className="h-8 w-8 mb-2 text-zinc-700" />
                <span>No equipment category incidents recorded yet.</span>
                <span className="text-[10px] text-zinc-600 mt-1">Submit a complaint to dynamically populate distribution telemetry.</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Severity Distribution Pie Chart */}
        <Card className="border-zinc-800 bg-zinc-950/70">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-mono font-bold text-white flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-zinc-300" />
              Urgency Severity Breakdown
            </CardTitle>
            <CardDescription className="text-xs text-zinc-400">
              Distribution of maintenance urgency
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4 flex flex-col items-center justify-between">
            {metrics && Object.values(metrics.urgency_distribution || {}).reduce((a, b) => a + b, 0) > 0 ? (
              <>
                <div className="h-44 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={Object.entries(metrics.urgency_distribution).map(([name, value]) => ({
                          name,
                          value,
                        }))}
                        cx="50%"
                        cy="50%"
                        innerRadius={45}
                        outerRadius={70}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {Object.keys(metrics.urgency_distribution).map((key) => (
                          <Cell
                            key={key}
                            fill={URGENCY_COLORS[key as keyof typeof URGENCY_COLORS] || '#71717a'}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#09090b',
                          borderColor: '#27272a',
                          borderRadius: '8px',
                          fontSize: '11px',
                          fontFamily: 'monospace',
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                {/* Legend */}
                <div className="grid grid-cols-2 gap-2 w-full pt-3 border-t border-zinc-850 font-mono text-[11px]">
                  {Object.entries(metrics.urgency_distribution).map(([urg, count]) => (
                    <div key={urg} className="flex items-center justify-between p-1.5 rounded bg-zinc-900/50">
                      <div className="flex items-center gap-1.5">
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{
                            backgroundColor:
                              URGENCY_COLORS[urg as keyof typeof URGENCY_COLORS] || '#71717a',
                          }}
                        />
                        <span className="text-zinc-300">{urg}</span>
                      </div>
                      <span className="font-bold text-white">{count}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="h-44 w-full flex flex-col items-center justify-center text-center p-4 text-zinc-500 font-mono text-xs border border-dashed border-zinc-850 rounded-lg">
                <AlertTriangle className="h-6 w-6 mb-2 text-zinc-700" />
                <span>All severities cleared.</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
 
       {/* Money Management & Workforce Budget vs Spending Bar Chart */}
       <Card className="border-zinc-800 bg-zinc-950/70 shadow-md">
         <CardHeader className="pb-3 border-b border-zinc-850 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
           <div>
             <CardTitle className="text-sm font-mono font-bold text-white flex items-center gap-2">
               <Wallet className="h-4 w-4 text-emerald-400" />
               Money Management &amp; Monthly Spending vs Budgeted Allocation
             </CardTitle>
             <CardDescription className="text-xs text-zinc-400 mt-0.5">
               Financial telemetry comparing planned infrastructure maintenance budgets against actual labor payouts and parts expenditures.
             </CardDescription>
           </div>
 
           <div className="flex items-center gap-3 font-mono text-xs">
             <div className="p-2 rounded-md bg-zinc-900 border border-zinc-800 flex items-center gap-2 text-zinc-300">
               <IndianRupee className="h-3.5 w-3.5 text-emerald-400" />
               <span>Settled Staff Payouts: <strong className="text-white">₹{(metrics?.total_labor_paid_inr || 0).toLocaleString('en-IN')}</strong></span>
             </div>
             <div className="p-2 rounded-md bg-zinc-900 border border-zinc-800 flex items-center gap-2 text-zinc-300 hidden md:flex">
               <TrendingUp className="h-3.5 w-3.5 text-sky-400" />
               <span>Technicians Active: <strong className="text-white">{metrics?.total_technicians_count ?? 0} Staff</strong></span>
             </div>
           </div>
         </CardHeader>
 
         <CardContent className="pt-4">
           {metrics?.spending_vs_budget && metrics.spending_vs_budget.length > 0 ? (
             <div className="h-72 w-full">
               <ResponsiveContainer width="100%" height="100%">
                 <BarChart
                   data={metrics.spending_vs_budget}
                   margin={{ top: 15, right: 20, left: 10, bottom: 10 }}
                 >
                   <CartesianGrid strokeDasharray="2 2" stroke="#27272a" opacity={0.6} />
                   <XAxis
                     dataKey="month"
                     tick={{ fill: '#a1a1aa', fontSize: 11, fontFamily: 'monospace' }}
                   />
                   <YAxis
                     tick={{ fill: '#a1a1aa', fontSize: 11, fontFamily: 'monospace' }}
                     tickFormatter={(val) => `₹${val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}`}
                   />
                   <Tooltip
                     contentStyle={{
                       backgroundColor: '#09090b',
                       borderColor: '#27272a',
                       borderRadius: '8px',
                       fontSize: '11px',
                       fontFamily: 'monospace',
                       color: '#ffffff',
                     }}
                     formatter={(value: any) => [`₹${Number(value).toLocaleString('en-IN')}`, '']}
                   />
                   <Legend
                     wrapperStyle={{ paddingTop: '10px', fontSize: '11px', fontFamily: 'monospace' }}
                   />
                   <Bar dataKey="budget_allocation" fill="#52525b" radius={[4, 4, 0, 0]} name="Budget Allocation (₹)" />
                   <Bar dataKey="actual_spending" fill="#10b981" radius={[4, 4, 0, 0]} name="Actual Spending (₹)" />
                   <Bar dataKey="labor_spend" fill="#38bdf8" radius={[4, 4, 0, 0]} name="Labor Payouts (₹)" />
                   <Bar dataKey="parts_spend" fill="#f59e0b" radius={[4, 4, 0, 0]} name="Replacement Parts (₹)" />
                 </BarChart>
               </ResponsiveContainer>
             </div>
           ) : (
             <div className="h-64 flex flex-col items-center justify-center text-center p-6 text-zinc-500 font-mono text-xs border border-dashed border-zinc-850 rounded-lg">
               <Wallet className="h-8 w-8 mb-2 text-zinc-700" />
               <span>No monthly financial allocations recorded yet.</span>
             </div>
           )}
         </CardContent>
       </Card>

      {/* Campus Location Hotspots */}
      <Card className="border-zinc-800 bg-zinc-950/70">
        <CardHeader className="pb-3 border-b border-zinc-850 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-sm font-mono font-bold text-white flex items-center gap-2">
              <MapPin className="h-4 w-4 text-zinc-300" />
              Campus Location Hotspots &amp; Incident Concentrations
            </CardTitle>
            <CardDescription className="text-xs text-zinc-400">
              Locations requiring frequent equipment maintenance interventions
            </CardDescription>
          </div>
          <span className="text-[10px] font-mono text-zinc-400">Top Zones</span>
        </CardHeader>
        <CardContent className="p-4">
          {metrics?.location_breakdown && metrics.location_breakdown.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 font-mono text-xs">
              {metrics.location_breakdown.slice(0, 10).map((loc, idx) => (
                <div
                  key={loc.location}
                  onClick={() => onExploreEvidence(`Issues at ${loc.location}`)}
                  className="p-3 rounded-lg bg-zinc-900/60 border border-zinc-800 hover:border-zinc-600 cursor-pointer transition-all flex flex-col justify-between"
                >
                  <div className="flex items-center justify-between text-zinc-400 text-[10px] mb-1">
                    <span>ZONE #{idx + 1}</span>
                    <ExternalLink className="h-3 w-3 text-zinc-500" />
                  </div>
                  <h4 className="font-bold text-white text-xs truncate" title={loc.location}>
                    {loc.location}
                  </h4>
                  <div className="mt-2 text-[11px] text-zinc-400">
                    <span>{loc.count} Incidents</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center text-zinc-500 font-mono text-xs border border-dashed border-zinc-850 rounded-lg">
              No campus hotspots recorded.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dual-Mode Reset Confirmation Modal */}
      {isClearModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-zinc-950 border border-zinc-800 rounded-xl max-w-lg w-full p-6 space-y-5 shadow-2xl relative font-sans">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-red-950 border border-red-800 text-red-400">
                <Trash2 className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white font-mono">Workspace Reset &amp; Clean Slate</h3>
                <p className="text-xs text-zinc-400 mt-0.5 font-mono">
                  Select clean slate mode to wipe test data or perform a hard serial counter reset.
                </p>
              </div>
            </div>

            {/* Mode selection radio pills */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono">
              <div
                onClick={() => setClearMode('soft')}
                className={`p-3 rounded-lg border cursor-pointer transition-all ${
                  clearMode === 'soft'
                    ? 'border-white bg-zinc-900 text-white'
                    : 'border-zinc-800 bg-black/50 text-zinc-400 hover:border-zinc-700'
                }`}
              >
                <div className="font-bold flex items-center justify-between">
                  <span>1. Soft Clean Slate</span>
                  {clearMode === 'soft' && <CheckCircle2 className="h-4 w-4 text-emerald-400" />}
                </div>
                <p className="text-[11px] text-zinc-400 mt-1">
                  Wipes all active complaints &amp; work orders. Preserves database sequence numbers.
                </p>
              </div>

              <div
                onClick={() => setClearMode('hard')}
                className={`p-3 rounded-lg border cursor-pointer transition-all ${
                  clearMode === 'hard'
                    ? 'border-red-600 bg-red-950/40 text-red-200'
                    : 'border-zinc-800 bg-black/50 text-zinc-400 hover:border-zinc-700'
                }`}
              >
                <div className="font-bold flex items-center justify-between">
                  <span>2. Hard Factory Reset</span>
                  {clearMode === 'hard' && <CheckCircle2 className="h-4 w-4 text-red-400" />}
                </div>
                <p className="text-[11px] text-zinc-400 mt-1">
                  Completely wipes all complaints, diagnoses, and resets counter back to #1 (WO-0001).
                </p>
              </div>
            </div>

            <div className="p-3 rounded bg-zinc-900/80 border border-zinc-800 text-xs font-mono text-zinc-300 space-y-1">
              {clearMode === 'hard' ? (
                <>
                  <div className="text-red-400 font-bold">● Hard Factory Sequence Reset:</div>
                  <div>● All complaints, diagnoses, recommendations &amp; agent runs will be wiped.</div>
                  <div>● SQLite sequence counter will be reset to 0 (Next issue is WO-0001).</div>
                  <div>● Vector store custom complaint documents will be cleared.</div>
                </>
              ) : (
                <>
                  <div className="text-zinc-200 font-bold">● Soft Clean Slate:</div>
                  <div>● All active complaints and work orders will be purged.</div>
                  <div>● Knowledge Base master taxonomy remains 100% intact.</div>
                </>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 pt-2 border-t border-zinc-800 font-mono">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsClearModalOpen(false)}
                disabled={isClearing}
                className="border-zinc-800 text-zinc-400 hover:text-white text-xs"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleExecuteClear}
                disabled={isClearing}
                className={`text-xs font-bold ${
                  clearMode === 'hard'
                    ? 'bg-red-600 hover:bg-red-500 text-white'
                    : 'bg-white hover:bg-zinc-200 text-black'
                }`}
              >
                {isClearing
                  ? 'Processing Reset...'
                  : clearMode === 'hard'
                  ? 'Execute Hard Reset to #1'
                  : 'Execute Clean Slate'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Global Universal Multi-Dimensional Search Modal */}
      <GlobalSearchModal
        isOpen={isGlobalSearchOpen}
        onClose={() => setIsGlobalSearchOpen(false)}
        onInspectComplaint={onInspectComplaint}
        onSelectForComplaint={onSelectSearchForComplaint}
      />

      {/* Labor Settlement & Technician Assignment Modal */}
      <ResolveWorkOrderModal
        isOpen={!!resolvingWorkOrder}
        workOrder={resolvingWorkOrder}
        onClose={() => setResolvingWorkOrder(null)}
        onSuccess={(msg) => {
          addToast('success', 'Work Order Completed & Settled', msg);
          setResolvingWorkOrder(null);
          loadData(true);
        }}
      />
    </div>
  );
};
