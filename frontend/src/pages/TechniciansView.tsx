import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Banknote,
  Briefcase,
  HardHat,
  IndianRupee,
  Loader2,
  Phone,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  TrendingUp,
  Users,
  X,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Button } from '../components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { ToastContainer, ToastMessage } from '../components/Toast';
import {
  createTechnician,
  deleteTechnician,
  fetchDashboardMetrics,
  fetchTechnicians,
  updateTechnician,
} from '../services/api';
import { SpendingBudgetPoint, TechnicianStaff, TechniciansSummary } from '../types';

interface TechniciansViewProps {
  onAssignToComplaint?: (tech: TechnicianStaff) => void;
}

export const TechniciansView: React.FC<TechniciansViewProps> = () => {
  const [data, setData] = useState<TechniciansSummary | null>(null);
  const [spendingData, setSpendingData] = useState<SpendingBudgetPoint[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState<string>('');
  const [roleFilter, setRoleFilter] = useState<string>('All');
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Add Worker Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newRole, setNewRole] = useState('HVAC Specialist');
  const [newHourlyRate, setNewHourlyRate] = useState<number>(400);
  const [newPerJobRate, setNewPerJobRate] = useState<number>(850);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Edit Rate Modal State
  const [editingTech, setEditingTech] = useState<TechnicianStaff | null>(null);
  const [editRate, setEditRate] = useState<number>(850);

  const addToast = (type: ToastMessage['type'], title: string, description?: string) => {
    const id = Date.now().toString();
    setToasts((prev) => [...prev, { id, type, title, description }]);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const loadTechnicians = async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const [res, metricsRes] = await Promise.all([
        fetchTechnicians(),
        fetchDashboardMetrics().catch(() => null),
      ]);
      setData(res);
      if (metricsRes?.spending_vs_budget && metricsRes.spending_vs_budget.length > 0) {
        setSpendingData(metricsRes.spending_vs_budget);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load technician roster');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    loadTechnicians();
  }, []);

  const handleAddTechnician = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newPhone.trim()) return;

    setIsSubmitting(true);
    try {
      const created = await createTechnician({
        name: newName.trim(),
        phone: newPhone.trim(),
        role: newRole,
        hourly_rate: Number(newHourlyRate),
        per_job_rate: Number(newPerJobRate),
        status: 'Available',
      });

      addToast('success', 'Technician Registered', `${created.name} added to maintenance staff.`);
      setIsAddModalOpen(false);
      setNewName('');
      setNewPhone('');
      await loadTechnicians(true);
    } catch (err: unknown) {
      addToast('error', 'Registration Failed', err instanceof Error ? err.message : 'Error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteTechnician = async (tech: TechnicianStaff) => {
    if (!confirm(`Are you sure you want to remove ${tech.name} from active staff?`)) return;
    try {
      await deleteTechnician(tech.id);
      addToast('info', 'Technician Removed', `${tech.name} has been removed.`);
      await loadTechnicians(true);
    } catch (err: unknown) {
      addToast('error', 'Delete Failed', err instanceof Error ? err.message : 'Error');
    }
  };

  const handleStatusToggle = async (tech: TechnicianStaff) => {
    const nextStatus =
      tech.status === 'Available' ? 'On Job' : tech.status === 'On Job' ? 'Off Duty' : 'Available';
    try {
      await updateTechnician(tech.id, { status: nextStatus });
      addToast('success', `${tech.name} Status Updated`, `Now marked as ${nextStatus}`);
      await loadTechnicians(true);
    } catch (err: unknown) {
      addToast('error', 'Status Update Failed', err instanceof Error ? err.message : 'Error');
    }
  };

  const handleUpdateRate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTech) return;
    try {
      await updateTechnician(editingTech.id, { per_job_rate: Number(editRate) });
      addToast('success', 'Salary Rate Updated', `${editingTech.name}'s rate is now ₹${editRate}/job`);
      setEditingTech(null);
      await loadTechnicians(true);
    } catch (err: unknown) {
      addToast('error', 'Update Failed', err instanceof Error ? err.message : 'Error');
    }
  };

  const filteredTechs = (data?.technicians || []).filter((t) => {
    const matchesSearch =
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.phone.includes(search) ||
      t.role.toLowerCase().includes(search.toLowerCase());
    const matchesRole = roleFilter === 'All' || t.role.toLowerCase().includes(roleFilter.toLowerCase());
    return matchesSearch && matchesRole;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-in fade-in duration-300 pb-16 font-sans">
      <ToastContainer toasts={toasts} onDismiss={removeToast} />

      {/* Header & Command Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-850 pb-5">
        <div>
          <div className="flex items-center gap-2 text-zinc-400 text-xs font-mono uppercase tracking-wider mb-1.5">
            <Users className="h-4 w-4 text-emerald-400" />
            <span>Staff Roster & Labor Accounting</span>
            <span className="text-[10px] px-2 py-0.5 rounded bg-zinc-900 border border-zinc-700 text-zinc-300">
              Money Management
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white font-mono">
            Technicians & Maintenance Workers
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Manage repair personnel, track individual job completions, and audit labor salaries &amp; campus payouts.
          </p>
        </div>

        {/* Global Actions */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadTechnicians()}
            className="border-zinc-800 hover:border-zinc-600 bg-zinc-950 text-zinc-300 text-xs font-mono flex items-center gap-1.5 active:scale-[0.98] transition-all"
          >
            <RefreshCw className="h-3.5 w-3.5 text-zinc-300" />
            <span>Refresh Roster</span>
          </Button>

          <Button
            size="sm"
            onClick={() => setIsAddModalOpen(true)}
            className="bg-white hover:bg-zinc-200 text-black text-xs font-mono font-bold px-4 flex items-center gap-1.5 shadow-sm active:scale-[0.98] transition-all"
          >
            <Plus className="h-4 w-4" />
            <span>+ Add Worker / Technician</span>
          </Button>
        </div>
      </div>

      {error && (
        <div className="p-3.5 rounded-lg bg-red-950/40 border border-red-900 text-red-300 text-xs flex items-center justify-between font-mono">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
          <Button size="sm" variant="outline" onClick={() => loadTechnicians()} className="text-xs">
            Retry
          </Button>
        </div>
      )}

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Registered Technicians */}
        <Card className="border-zinc-800 bg-zinc-950/70 hover:border-zinc-700 transition-all">
          <CardContent className="p-4 space-y-1">
            <span className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider">
              Total Staff Roster
            </span>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-bold font-mono text-white">
                {data ? data.total_technicians : '—'}
              </span>
              <Badge className="bg-zinc-900 text-zinc-300 border-zinc-700 font-mono text-[10px]">
                Active Workforce
              </Badge>
            </div>
            <p className="text-[10px] text-zinc-400 pt-1">
              Registered campus maintenance specialists
            </p>
          </CardContent>
        </Card>

        {/* Total Labor Salary Paid */}
        <Card className="border-zinc-800 bg-zinc-950/70 hover:border-emerald-800/60 transition-all">
          <CardContent className="p-4 space-y-1">
            <span className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider">
              Total Labor Paid
            </span>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-bold font-mono text-emerald-400">
                ₹{data ? data.total_labor_paid_inr.toLocaleString() : '0'}
              </span>
              <Badge className="bg-emerald-950 text-emerald-300 border-emerald-800 font-mono text-[10px]">
                Labor Ledger
              </Badge>
            </div>
            <p className="text-[10px] text-zinc-400 pt-1">
              Cumulative wages paid for completed jobs
            </p>
          </CardContent>
        </Card>

        {/* Total Jobs Handled */}
        <Card className="border-zinc-800 bg-zinc-950/70 hover:border-zinc-700 transition-all">
          <CardContent className="p-4 space-y-1">
            <span className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider">
              Total Jobs Completed
            </span>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-bold font-mono text-white">
                {data ? data.total_jobs_completed : '—'}
              </span>
              <Badge className="bg-zinc-900 text-zinc-300 border-zinc-700 font-mono text-[10px]">
                Verified Fixes
              </Badge>
            </div>
            <p className="text-[10px] text-zinc-400 pt-1">
              Successfully resolved work orders
            </p>
          </CardContent>
        </Card>

        {/* Active On-Duty Count */}
        <Card className="border-zinc-800 bg-zinc-950/70 hover:border-zinc-700 transition-all">
          <CardContent className="p-4 space-y-1">
            <span className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider">
              On-Duty Dispatch
            </span>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-bold font-mono text-white">
                {data ? data.active_on_duty : '0'}
              </span>
              <Badge className="bg-sky-950 text-sky-300 border-sky-800 font-mono text-[10px]">
                Live in Field
              </Badge>
            </div>
            <p className="text-[10px] text-zinc-400 pt-1">
              Workers currently assigned to open repairs
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 rounded-lg bg-zinc-950 border border-zinc-800">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search worker name, role, or phone..."
            className="w-full rounded-md border border-zinc-800 bg-black pl-9 pr-3 py-1.5 text-xs text-white focus:outline-none focus:border-zinc-500 font-mono"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto">
          <span className="text-[11px] font-mono text-zinc-400 uppercase">Skill:</span>
          {['All', 'HVAC', 'Electrician', 'Plumbing', 'AV', 'Handyman'].map((r) => (
            <button
              key={r}
              onClick={() => setRoleFilter(r)}
              className={`px-2.5 py-1 rounded text-xs font-mono transition-all ${
                roleFilter === r
                  ? 'bg-zinc-800 text-white border border-zinc-600'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-900 border border-transparent'
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Technicians Grid Roster */}
      {loading ? (
        <div className="p-12 text-center text-zinc-400 font-mono text-xs flex items-center justify-center gap-2">
          <Loader2 className="h-5 w-5 animate-spin text-white" />
          <span>Loading staff and salary records...</span>
        </div>
      ) : filteredTechs.length === 0 ? (
        <div className="p-12 text-center rounded-xl border border-dashed border-zinc-800 bg-zinc-950/40 text-zinc-400 font-mono text-xs space-y-2">
          <HardHat className="h-8 w-8 mx-auto text-zinc-600" />
          <p className="text-white font-semibold">No technicians found</p>
          <p className="text-zinc-400">Click &ldquo;+ Add Worker / Technician&rdquo; to register new maintenance personnel.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTechs.map((tech) => {
            const isAvailable = tech.status === 'Available';
            const isOnJob = tech.status === 'On Job';

            return (
              <div
                key={tech.id}
                className="rounded-xl border border-zinc-800 bg-zinc-950 p-4 space-y-3.5 hover:border-zinc-700 transition-all hover:shadow-lg hover:shadow-white/5 font-mono text-xs"
              >
                {/* Card Header: Avatar, Name, Status */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-zinc-900 border border-zinc-700 flex items-center justify-center text-white font-bold text-sm">
                      {tech.name.split(' ').map((n) => n[0]).join('')}
                    </div>
                    <div>
                      <h4 className="font-bold text-white text-sm tracking-tight">{tech.name}</h4>
                      <span className="text-[11px] text-zinc-400 flex items-center gap-1">
                        <Briefcase className="h-3 w-3 text-zinc-400" />
                        {tech.role}
                      </span>
                    </div>
                  </div>

                  {/* Status Badge Toggle */}
                  <button
                    onClick={() => handleStatusToggle(tech)}
                    title="Click to change availability status"
                    className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-all ${
                      isAvailable
                        ? 'bg-emerald-950/60 text-emerald-400 border-emerald-800 hover:bg-emerald-900/80'
                        : isOnJob
                        ? 'bg-sky-950/60 text-sky-400 border-sky-800 hover:bg-sky-900/80'
                        : 'bg-zinc-900 text-zinc-400 border-zinc-700 hover:bg-zinc-800'
                    }`}
                  >
                    ● {tech.status}
                  </button>
                </div>

                {/* Contact & Phone */}
                <div className="flex items-center justify-between p-2 rounded-md bg-zinc-900/60 border border-zinc-850 text-zinc-300 text-[11px]">
                  <span className="flex items-center gap-1.5">
                    <Phone className="h-3 w-3 text-emerald-400" />
                    <span>{tech.phone}</span>
                  </span>
                  <a
                    href={`tel:${tech.phone}`}
                    className="text-white hover:text-emerald-400 underline text-[10px]"
                  >
                    Call Now
                  </a>
                </div>

                {/* Salary & Rate Information */}
                <div className="grid grid-cols-2 gap-2 pt-1 border-t border-zinc-850/80">
                  <div className="p-2 rounded bg-zinc-900/30 border border-zinc-850">
                    <span className="text-[10px] text-zinc-400 uppercase block">Per-Job Fee</span>
                    <span className="text-sm font-bold text-white flex items-center">
                      <IndianRupee className="h-3 w-3 inline text-zinc-400" />
                      {tech.per_job_rate}
                    </span>
                    <span className="text-[9px] text-zinc-400">or ₹{tech.hourly_rate}/hr</span>
                  </div>

                  <div className="p-2 rounded bg-zinc-900/30 border border-zinc-850">
                    <span className="text-[10px] text-zinc-400 uppercase block">Total Earned</span>
                    <span className="text-sm font-bold text-emerald-400 flex items-center">
                      <IndianRupee className="h-3 w-3 inline" />
                      {tech.total_earnings.toLocaleString()}
                    </span>
                    <span className="text-[9px] text-zinc-400">{tech.total_jobs_completed} jobs done</span>
                  </div>
                </div>

                {/* Card Action Footer */}
                <div className="flex items-center justify-between pt-2 border-t border-zinc-850 text-[11px]">
                  <button
                    onClick={() => {
                      setEditingTech(tech);
                      setEditRate(tech.per_job_rate);
                    }}
                    className="text-zinc-400 hover:text-white flex items-center gap-1 transition-colors"
                  >
                    <Banknote className="h-3 w-3" />
                    <span>Adjust Rate</span>
                  </button>

                  <button
                    onClick={() => handleDeleteTechnician(tech)}
                    className="text-zinc-500 hover:text-red-400 flex items-center gap-1 transition-colors"
                  >
                    <Trash2 className="h-3 w-3" />
                    <span>Remove</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Workforce Cumulative Monthly Repair Spending vs Budgeted Allocation */}
      <Card className="border-zinc-800 bg-zinc-950/80 shadow-xl font-mono">
        <CardHeader className="pb-3 border-b border-zinc-850 flex flex-col md:flex-row md:items-center justify-between gap-2">
          <div>
            <CardTitle className="text-sm font-bold text-white flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-emerald-400" />
              Cumulative Monthly Repair Spending Trends vs. Budgeted Allocation
            </CardTitle>
            <CardDescription className="text-xs text-zinc-400 mt-0.5">
              Recharts audit tracker: Compare actual infrastructure repair payouts &amp; technician wages against allocated monthly budget.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-950/80 border border-emerald-800 text-emerald-300 font-bold">
              ₹ Ledger Audited
            </span>
          </div>
        </CardHeader>

        <CardContent className="p-4 space-y-6">
          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 rounded-lg bg-black/60 border border-zinc-850">
              <span className="text-[10px] text-zinc-400 block uppercase">Total Budget (6 Mo)</span>
              <span className="text-base font-bold text-white">
                ₹{spendingData.reduce((acc, p) => acc + p.budget_allocation, 0).toLocaleString()}
              </span>
            </div>

            <div className="p-3 rounded-lg bg-black/60 border border-zinc-850">
              <span className="text-[10px] text-zinc-400 block uppercase">Actual Total Spend</span>
              <span className="text-base font-bold text-zinc-200">
                ₹{spendingData.reduce((acc, p) => acc + p.actual_spending, 0).toLocaleString()}
              </span>
            </div>

            <div className="p-3 rounded-lg bg-black/60 border border-zinc-850">
              <span className="text-[10px] text-zinc-400 block uppercase">Labor Wages Paid</span>
              <span className="text-base font-bold text-emerald-400">
                ₹{spendingData.reduce((acc, p) => acc + p.labor_spend, 0).toLocaleString()}
              </span>
            </div>

            <div className="p-3 rounded-lg bg-black/60 border border-zinc-850">
              <span className="text-[10px] text-zinc-400 block uppercase">Net Budget Variance</span>
              <span className="text-base font-bold text-sky-400">
                +₹{(
                  spendingData.reduce((acc, p) => acc + p.budget_allocation, 0) -
                  spendingData.reduce((acc, p) => acc + p.actual_spending, 0)
                ).toLocaleString()} (Surplus)
              </span>
            </div>
          </div>

          {/* Recharts Area / Line Chart */}
          <div className="h-72 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={spendingData}
                margin={{ top: 10, right: 30, left: 10, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="colorBudget" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorActual" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ffffff" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#ffffff" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorLabor" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" opacity={0.6} />
                <XAxis
                  dataKey="month"
                  tick={{ fill: '#a1a1aa', fontSize: 11, fontFamily: 'monospace' }}
                />
                <YAxis
                  tick={{ fill: '#a1a1aa', fontSize: 11, fontFamily: 'monospace' }}
                  tickFormatter={(val) => `₹${(val / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  formatter={(value: any, name: any) => [
                    `₹${Number(value).toLocaleString()}`,
                    name === 'budget_allocation'
                      ? 'Budget Allocated'
                      : name === 'actual_spending'
                      ? 'Actual Repair Spend'
                      : name === 'labor_spend'
                      ? 'Labor Wages Paid'
                      : name === 'cumulative_spend'
                      ? 'Cumulative Spend'
                      : name,
                  ]}
                  contentStyle={{
                    backgroundColor: '#09090b',
                    borderColor: '#27272a',
                    borderRadius: '8px',
                    fontSize: '11px',
                    fontFamily: 'monospace',
                  }}
                />
                <Legend
                  wrapperStyle={{ fontSize: '11px', fontFamily: 'monospace', paddingTop: '10px' }}
                />
                <Area
                  type="monotone"
                  dataKey="budget_allocation"
                  stroke="#10b981"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorBudget)"
                  name="Budget Allocation"
                />
                <Area
                  type="monotone"
                  dataKey="actual_spending"
                  stroke="#ffffff"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorActual)"
                  name="Actual Spend"
                />
                <Area
                  type="monotone"
                  dataKey="labor_spend"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorLabor)"
                  name="Labor Wages"
                />
                <Line
                  type="monotone"
                  dataKey="cumulative_spend"
                  stroke="#a855f7"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  name="Cumulative Spend"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Tabular Monthly Breakdown */}
          {spendingData.length > 0 && (
            <div className="overflow-x-auto border border-zinc-850 rounded-lg">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-zinc-900/70 text-zinc-400 border-b border-zinc-850">
                  <tr>
                    <th className="p-2.5">Month</th>
                    <th className="p-2.5">Budget Allocation</th>
                    <th className="p-2.5">Actual Repair Spend</th>
                    <th className="p-2.5">Technician Wages</th>
                    <th className="p-2.5">Parts &amp; Materials</th>
                    <th className="p-2.5">Cumulative Spend</th>
                    <th className="p-2.5 text-right">Budget Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-850/60 bg-black/40">
                  {spendingData.map((row) => {
                    const variance = row.budget_allocation - row.actual_spending;
                    const isUnder = variance >= 0;
                    return (
                      <tr key={row.month} className="hover:bg-zinc-900/30">
                        <td className="p-2.5 font-bold text-white">{row.month}</td>
                        <td className="p-2.5 text-emerald-400">₹{row.budget_allocation.toLocaleString()}</td>
                        <td className="p-2.5 text-white font-semibold">₹{row.actual_spending.toLocaleString()}</td>
                        <td className="p-2.5 text-amber-400">₹{row.labor_spend.toLocaleString()}</td>
                        <td className="p-2.5 text-zinc-300">₹{row.parts_spend.toLocaleString()}</td>
                        <td className="p-2.5 text-purple-400 font-bold">₹{row.cumulative_spend.toLocaleString()}</td>
                        <td className="p-2.5 text-right">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] ${
                              isUnder
                                ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                                : 'bg-red-950 text-red-300 border border-red-800'
                            }`}
                          >
                            {isUnder ? `Under by ₹${variance.toLocaleString()}` : `Over by ₹${Math.abs(variance).toLocaleString()}`}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Worker Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="relative w-full max-w-md rounded-xl border border-zinc-700 bg-zinc-950 p-6 shadow-2xl text-white font-mono space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <HardHat className="h-4 w-4 text-emerald-400" />
                <span>Register Maintenance Personnel</span>
              </h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-zinc-400 hover:text-white p-1 rounded hover:bg-zinc-900"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleAddTechnician} className="space-y-3.5 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-zinc-300">Technician Full Name *</label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Ramesh Kumar / Suresh Patel"
                  className="w-full rounded-md border border-zinc-700 bg-black px-3 py-2 text-white focus:outline-none focus:border-white text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-zinc-300">Phone Number *</label>
                <input
                  type="text"
                  required
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  placeholder="e.g. +91 98765 43210"
                  className="w-full rounded-md border border-zinc-700 bg-black px-3 py-2 text-white focus:outline-none focus:border-white text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-zinc-300">Skill Specialization *</label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value)}
                  className="w-full rounded-md border border-zinc-700 bg-black px-3 py-2 text-white focus:outline-none focus:border-white text-xs"
                >
                  <option value="Senior HVAC Technician">Senior HVAC Technician</option>
                  <option value="Master Electrician">Master Electrician / Switchgear</option>
                  <option value="Plumbing & Piping Specialist">Plumbing &amp; Piping Specialist</option>
                  <option value="AV & Smart Classroom IT Tech">AV &amp; Smart Classroom IT Tech</option>
                  <option value="Network & Infrastructure Engineer">Network &amp; Infrastructure Engineer</option>
                  <option value="Diesel Generator & Power Tech">Diesel Generator &amp; Power Tech</option>
                  <option value="Elevator & Lift Engineer">Elevator &amp; Lift Engineer</option>
                  <option value="General Campus Handyman">General Campus Handyman</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-zinc-300">Standard Fee (₹/job) *</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={newPerJobRate}
                    onChange={(e) => setNewPerJobRate(Number(e.target.value))}
                    className="w-full rounded-md border border-zinc-700 bg-black px-3 py-2 text-white focus:outline-none focus:border-white text-xs font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-zinc-300">Hourly Rate (₹/hr)</label>
                  <input
                    type="number"
                    min="0"
                    value={newHourlyRate}
                    onChange={(e) => setNewHourlyRate(Number(e.target.value))}
                    className="w-full rounded-md border border-zinc-700 bg-black px-3 py-2 text-white focus:outline-none focus:border-white text-xs font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-800">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsAddModalOpen(false)}
                  className="text-xs border-zinc-700 text-zinc-400"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isSubmitting}
                  className="bg-white hover:bg-zinc-200 text-black text-xs font-bold px-4 flex items-center gap-1.5"
                >
                  {isSubmitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                  <span>Save Technician</span>
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Rate Modal */}
      {editingTech && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="relative w-full max-w-sm rounded-xl border border-zinc-700 bg-zinc-950 p-5 shadow-2xl text-white font-mono space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-2.5">
              <h3 className="font-bold text-white flex items-center gap-2">
                <Banknote className="h-4 w-4 text-emerald-400" />
                <span>Adjust Salary Rate</span>
              </h3>
              <button
                onClick={() => setEditingTech(null)}
                className="text-zinc-400 hover:text-white p-1"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleUpdateRate} className="space-y-3">
              <p className="text-zinc-400">
                Updating salary payout rate for <strong className="text-white">{editingTech.name}</strong> ({editingTech.role}):
              </p>

              <div className="space-y-1">
                <label className="font-semibold text-zinc-300">Standard Payout (₹/job)</label>
                <input
                  type="number"
                  min="0"
                  required
                  value={editRate}
                  onChange={(e) => setEditRate(Number(e.target.value))}
                  className="w-full rounded-md border border-zinc-700 bg-black px-3 py-2 text-white focus:outline-none focus:border-emerald-400 font-mono text-sm"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-800">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setEditingTech(null)}
                  className="text-xs border-zinc-700 text-zinc-400"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs"
                >
                  Update Rate
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
