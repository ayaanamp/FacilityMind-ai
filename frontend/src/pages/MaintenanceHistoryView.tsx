import React, { useEffect, useState } from 'react';
import {
  AlertOctagon,
  AlertTriangle,
  Boxes,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  ExternalLink,
  Eye,
  FileText,
  FolderArchive,
  IndianRupee,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
  Wrench,
  X,
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Card, CardContent } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { AddEquipmentModal } from '../components/AddEquipmentModal';
import { ToastContainer, ToastMessage } from '../components/Toast';
import {
  clearAllMaintenanceRecords,
  deleteMaintenanceRecord,
  fetchEquipmentCategories,
  fetchMaintenanceRecords,
  reseedMaintenanceRecords,
  updateMaintenanceRecordStatus,
} from '../services/api';
import { MaintenanceRecordItem } from '../types';

interface MaintenanceHistoryViewProps {
  onLoadComplaintToAnalyze?: (complaint: string, equipment: string) => void;
  onInspectComplaint?: (complaintId: number) => void;
}

export const MaintenanceHistoryView: React.FC<MaintenanceHistoryViewProps> = ({
  onLoadComplaintToAnalyze,
  onInspectComplaint,
}) => {
  const [records, setRecords] = useState<MaintenanceRecordItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [equipmentType, setEquipmentType] = useState('');
  const [urgency, setUrgency] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'resolved'>('all');
  const [page, setPage] = useState(0);
  const limit = 20;

  const [categories, setCategories] = useState<Array<{ type: string; count: number }>>([]);
  const [selectedRecord, setSelectedRecord] = useState<MaintenanceRecordItem | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isClearAllModalOpen, setIsClearAllModalOpen] = useState(false);
  const [clearingAll, setClearingAll] = useState(false);
  const [actionPendingId, setActionPendingId] = useState<number | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = (type: ToastMessage['type'], title: string, description?: string) => {
    const id = Date.now().toString();
    setToasts((prev) => [...prev, { id, type, title, description }]);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  useEffect(() => {
    fetchEquipmentCategories().then(setCategories).catch(() => {});
  }, []);

  const loadRecords = async () => {
    setLoading(true);
    setError(null);
    try {
      let statusParam: string | undefined = undefined;
      if (statusFilter === 'active') statusParam = 'Triage Pending';
      else if (statusFilter === 'resolved') statusParam = 'Resolved';

      const data = await fetchMaintenanceRecords({
        search: search || undefined,
        equipment_type: equipmentType || undefined,
        urgency: urgency || undefined,
        status: statusParam,
        skip: page * limit,
        limit,
      });
      setRecords(data.records);
      setTotal(data.total);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to query records');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRecords();
  }, [page, equipmentType, urgency, statusFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(0);
    loadRecords();
  };

  const handleEquipmentAdded = (newCategory: string) => {
    addToast(
      'success',
      `Category '${newCategory}' Registered`,
      'New equipment diagnostic taxonomy and vector embeddings added to Knowledge Base.'
    );
    fetchEquipmentCategories().then(setCategories).catch(() => {});
    loadRecords();
  };

  const handleToggleResolve = async (r: MaintenanceRecordItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const newStatus = r.status === 'Resolved' || r.status === 'Completed' ? 'In Progress' : 'Resolved';
    setActionPendingId(r.id);
    try {
      await updateMaintenanceRecordStatus(r.id, newStatus, 'Status updated from Knowledge Base view.');
      addToast(
        'success',
        `Case #${r.id} Marked as ${newStatus}`,
        `Equipment ${r.equipment_type} status synchronized across database and vector store.`
      );
      if (selectedRecord && selectedRecord.id === r.id) {
        setSelectedRecord({ ...selectedRecord, status: newStatus });
      }
      loadRecords();
    } catch (err: unknown) {
      addToast('error', 'Status Update Failed', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setActionPendingId(null);
    }
  };

  const handleDeleteRecord = async (recordId: number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!window.confirm(`Are you sure you want to permanently delete Case #${recordId} from Knowledge Base?`)) {
      return;
    }
    setActionPendingId(recordId);
    try {
      await deleteMaintenanceRecord(recordId);
      addToast(
        'info',
        `Case #${recordId} Deleted`,
        'Record permanently purged from SQLite database and indexed vector catalog.'
      );
      if (selectedRecord && selectedRecord.id === recordId) {
        setSelectedRecord(null);
      }
      loadRecords();
      fetchEquipmentCategories().then(setCategories).catch(() => {});
    } catch (err: unknown) {
      addToast('error', 'Deletion Failed', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setActionPendingId(null);
    }
  };

  const handleClearAllHistory = async () => {
    setClearingAll(true);
    try {
      await clearAllMaintenanceRecords();
      setIsClearAllModalOpen(false);
      addToast(
        'success',
        'Knowledge Base Cleared',
        'All historical maintenance records purged and vector indices reset.'
      );
      setSelectedRecord(null);
      setPage(0);
      loadRecords();
      fetchEquipmentCategories().then(setCategories).catch(() => {});
    } catch (err: unknown) {
      addToast('error', 'Clear History Failed', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setClearingAll(false);
    }
  };

  const [reseeding, setReseeding] = useState(false);

  const handleReseedRecords = async () => {
    setReseeding(true);
    try {
      const res = await reseedMaintenanceRecords();
      addToast(
        'success',
        'Knowledge Base Re-Seeded',
        `Restored ${res.total_records} campus maintenance cases and vector embeddings.`
      );
      setPage(0);
      loadRecords();
      fetchEquipmentCategories().then(setCategories).catch(() => {});
    } catch (err: unknown) {
      addToast('error', 'Re-Seed Failed', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setReseeding(false);
    }
  };

  const getUrgencyBadge = (urg: string) => {
    switch (urg) {
      case 'Critical':
        return <Badge className="bg-red-950 text-red-400 border border-red-800 font-mono text-[10px]">{urg}</Badge>;
      case 'High':
        return <Badge className="bg-amber-950 text-amber-400 border border-amber-800 font-mono text-[10px]">{urg}</Badge>;
      case 'Low':
        return <Badge className="bg-emerald-950 text-emerald-400 border border-emerald-800 font-mono text-[10px]">{urg}</Badge>;
      default:
        return <Badge className="bg-zinc-800 text-zinc-300 border border-zinc-700 font-mono text-[10px]">{urg}</Badge>;
    }
  };

  const getStatusBadge = (status?: string) => {
    if (status === 'Resolved' || status === 'Completed') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-emerald-950/80 text-emerald-400 border border-emerald-800/80">
          <CheckCircle2 className="h-3 w-3" />
          Resolved
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-zinc-800 text-zinc-300 border border-zinc-700">
        <Clock className="h-3 w-3 text-amber-400" />
        {status || 'Active'}
      </span>
    );
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-in fade-in duration-300 pb-16 font-sans">
      <ToastContainer toasts={toasts} onDismiss={removeToast} />

      {error && (
        <div className="p-3 rounded-lg bg-zinc-950 border border-red-900/60 text-red-400 text-xs flex items-center gap-2 font-mono">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Header */}
      <div className="border-b border-zinc-800 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-zinc-400 text-xs font-mono uppercase tracking-wider mb-1">
            <FolderArchive className="h-4 w-4 text-white" />
            <span>Master Case Archive & Technical Knowledge Base</span>
          </div>
          <h2 className="text-xl font-bold tracking-tight text-white font-mono">
            Campus Maintenance Knowledge Base ({total} Records)
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5 font-mono">
            Searchable historical incident repository powering the retrieval and diagnosis agents.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Button to Re-Seed Demo Dataset */}
          <Button
            size="sm"
            onClick={handleReseedRecords}
            disabled={reseeding}
            className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-mono font-semibold flex items-center gap-1.5 shadow-sm active:scale-95 transition-all"
            title="Populate full 278+ diverse campus maintenance cases"
          >
            {reseeding ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="h-3.5 w-3.5" />
            )}
            <span>{reseeding ? 'Seeding...' : 'Re-Seed 278+ Cases'}</span>
          </Button>

          {/* Button to Add New Equipment Category via Modal */}
          <Button
            size="sm"
            variant="outline"
            onClick={() => setIsAddModalOpen(true)}
            className="border-zinc-700 bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-mono font-semibold flex items-center gap-1.5 shadow-sm"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>+ Define Taxonomy</span>
          </Button>

          {/* Button to Clear All History Records */}
          <Button
            size="sm"
            variant="outline"
            onClick={() => setIsClearAllModalOpen(true)}
            className="border-red-900/60 bg-red-950/20 text-red-400 hover:bg-red-950/50 hover:text-red-300 font-mono text-xs flex items-center gap-1.5"
            title="Purge all historical records from the database and vector store"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>Clear KB</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => loadRecords()}
            className="border-zinc-800 text-zinc-300 hover:text-white bg-zinc-950 font-mono text-xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Quick Status Filter Pills */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => { setStatusFilter('all'); setPage(0); }}
          className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-all ${
            statusFilter === 'all'
              ? 'bg-zinc-800 text-white border border-zinc-600 shadow-sm'
              : 'bg-zinc-950 text-zinc-400 hover:text-white border border-zinc-850'
          }`}
        >
          All Records ({total})
        </button>
        <button
          onClick={() => { setStatusFilter('active'); setPage(0); }}
          className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium flex items-center gap-1.5 transition-all ${
            statusFilter === 'active'
              ? 'bg-amber-950/60 text-amber-300 border border-amber-800 shadow-sm'
              : 'bg-zinc-950 text-zinc-400 hover:text-amber-300 border border-zinc-850'
          }`}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
          Active Complaints / In Triage
        </button>
        <button
          onClick={() => { setStatusFilter('resolved'); setPage(0); }}
          className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium flex items-center gap-1.5 transition-all ${
            statusFilter === 'resolved'
              ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-800 shadow-sm'
              : 'bg-zinc-950 text-zinc-400 hover:text-emerald-300 border border-zinc-850'
          }`}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          Resolved Cases
        </button>
      </div>

      {/* Search & Filter Controls */}
      <Card className="border-zinc-800 bg-zinc-950/80">
        <CardContent className="p-4">
          <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by reporter name, contact number, failure symptoms, room, or equipment..."
                className="w-full rounded-md border border-zinc-800 bg-black pl-9 pr-3 py-2 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500 font-mono"
              />
            </div>

            <div className="sm:w-56">
              <select
                value={equipmentType}
                onChange={(e) => {
                  setEquipmentType(e.target.value);
                  setPage(0);
                }}
                className="w-full rounded-md border border-zinc-800 bg-black px-3 py-2 text-xs text-zinc-300 focus:outline-none focus:border-zinc-500 font-mono"
              >
                <option value="">All Categories ({categories.reduce((acc, c) => acc + c.count, 0)})</option>
                {categories.map((c) => (
                  <option key={c.type} value={c.type}>
                    {c.type} ({c.count})
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:w-36">
              <select
                value={urgency}
                onChange={(e) => {
                  setUrgency(e.target.value);
                  setPage(0);
                }}
                className="w-full rounded-md border border-zinc-800 bg-black px-3 py-2 text-xs text-zinc-300 focus:outline-none focus:border-zinc-500 font-mono"
              >
                <option value="">All Severity</option>
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
                <option value="Critical">Critical</option>
              </select>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="bg-zinc-900 hover:bg-zinc-800 border border-zinc-750 text-white text-xs font-mono px-4 shrink-0"
            >
              Filter Records
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Table of Records */}
      <Card className="border-zinc-800 bg-zinc-950/80 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-sans">
            <thead className="border-b border-zinc-850 bg-black/70 text-zinc-400 text-[11px] font-mono uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Case #</th>
                <th className="py-3 px-4">Equipment &amp; Tag</th>
                <th className="py-3 px-4">Location</th>
                <th className="py-3 px-4 min-w-[220px]">Observed Complaint &amp; Reporter</th>
                <th className="py-3 px-4 min-w-[200px]">Verified Root Cause</th>
                <th className="py-3 px-4">Est. Cost</th>
                <th className="py-3 px-4">Severity</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right min-w-[150px]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-850/80">
              {loading && records.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-zinc-500 font-mono">
                    <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2 text-emerald-400" />
                    Querying Knowledge Base archive...
                  </td>
                </tr>
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-zinc-500 font-mono">
                    No matching technical records found.
                  </td>
                </tr>
              ) : (
                records.map((r) => (
                  <tr
                    key={r.id}
                    className="hover:bg-zinc-900/60 transition-colors cursor-pointer group"
                    onClick={() => setSelectedRecord(r)}
                  >
                    <td className="py-3.5 px-4 font-mono font-bold text-zinc-400 text-[11px]">#{r.id}</td>
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-white text-xs">{r.equipment_type}</div>
                      <div className="text-[10px] font-mono text-zinc-400">{r.equipment_id}</div>
                    </td>
                    <td className="py-3.5 px-4 text-zinc-300 text-xs" title={r.location}>
                      {r.location}
                    </td>
                    <td className="py-3.5 px-4 text-zinc-200 text-xs">
                      <p className="line-clamp-2 leading-relaxed" title={r.complaint}>
                        {r.complaint}
                      </p>
                      {r.technician_notes && (r.technician_notes.includes('Reporter:') || r.technician_notes.includes('Reported by')) && (
                        <div className="text-[10px] font-mono text-emerald-400/90 mt-1 flex items-center gap-1">
                          <span className="truncate max-w-[220px]" title={r.technician_notes}>
                            👤 {r.technician_notes.split('|')[0] || r.technician_notes}
                          </span>
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-zinc-400 text-xs">
                      <p className="line-clamp-2 leading-relaxed" title={r.root_cause}>
                        {r.root_cause}
                      </p>
                    </td>
                    <td className="py-3.5 px-4 text-white font-mono font-bold text-xs whitespace-nowrap">
                      ₹{r.estimated_cost.toLocaleString('en-IN')}
                    </td>
                    <td className="py-3.5 px-4">{getUrgencyBadge(r.urgency)}</td>
                    <td className="py-3.5 px-4 whitespace-nowrap">{getStatusBadge(r.status)}</td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                        <Button
                          size="sm"
                          variant="outline"
                          title={r.status === 'Resolved' || r.status === 'Completed' ? 'Mark In Progress' : 'Mark Resolved'}
                          disabled={actionPendingId === r.id}
                          onClick={(e) => handleToggleResolve(r, e)}
                          className={`h-7 px-2 text-[11px] font-sans border-zinc-750 transition-all ${
                            r.status === 'Resolved' || r.status === 'Completed'
                              ? 'bg-emerald-950/40 text-emerald-300 border-emerald-800/60 hover:bg-emerald-900/50'
                              : 'bg-zinc-900 text-zinc-300 hover:text-emerald-400 hover:border-emerald-800'
                          }`}
                        >
                          {actionPendingId === r.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                          )}
                        </Button>

                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedRecord(r);
                          }}
                          className="h-7 px-2 text-[11px] font-sans border-zinc-750 bg-zinc-900 text-zinc-200 hover:text-white hover:bg-zinc-800"
                          title="Inspect Case"
                        >
                          <Eye className="h-3.5 w-3.5 text-zinc-400" />
                        </Button>

                        <Button
                          size="sm"
                          variant="outline"
                          title="Delete Case from KB"
                          disabled={actionPendingId === r.id}
                          onClick={(e) => handleDeleteRecord(r.id, e)}
                          className="h-7 px-2 text-[11px] font-sans border-zinc-800 bg-zinc-900/70 text-zinc-400 hover:text-red-400 hover:border-red-900 hover:bg-red-950/30"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="flex items-center justify-between p-3 border-t border-zinc-850 text-xs font-mono text-zinc-400">
          <div>
            Showing {records.length > 0 ? page * limit + 1 : 0} -{' '}
            {Math.min((page + 1) * limit, total)} of {total} records
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 0 || loading}
              onClick={() => setPage((prev) => Math.max(0, prev - 1))}
              className="h-7 text-xs border-zinc-800 bg-zinc-900 text-zinc-300 disabled:opacity-40"
            >
              <ChevronLeft className="h-3.5 w-3.5 mr-1" />
              Prev
            </Button>
            <span className="px-2">Page {page + 1} of {Math.max(1, Math.ceil(total / limit))}</span>
            <Button
              variant="outline"
              size="sm"
              disabled={(page + 1) * limit >= total || loading}
              onClick={() => setPage((prev) => prev + 1)}
              className="h-7 text-xs border-zinc-800 bg-zinc-900 text-zinc-300 disabled:opacity-40"
            >
              Next
              <ChevronRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          </div>
        </div>
      </Card>

      {/* Add Equipment Taxonomy Modal */}
      <AddEquipmentModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={handleEquipmentAdded}
      />

      {/* Clear All Confirmation Modal */}
      {isClearAllModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in">
          <div className="bg-zinc-950 border border-red-900/60 rounded-xl max-w-md w-full p-6 space-y-4 shadow-2xl font-sans">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-red-950/60 border border-red-800 text-red-400">
                <AlertOctagon className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white font-mono">Clear Knowledge Base?</h3>
                <p className="text-xs text-zinc-400 font-mono">Irreversible archive deletion</p>
              </div>
            </div>

            <p className="text-xs text-zinc-300 leading-relaxed">
              This will permanently purge <span className="font-bold text-white font-mono">{total} records</span> from the SQLite database and reset all vector embeddings. AI diagnostic agents will have to rely on zero-shot inference until new cases are seeded.
            </p>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-800">
              <Button
                variant="outline"
                size="sm"
                disabled={clearingAll}
                onClick={() => setIsClearAllModalOpen(false)}
                className="border-zinc-800 text-zinc-400 hover:text-white text-xs font-mono"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={clearingAll}
                onClick={handleClearAllHistory}
                className="bg-red-600 hover:bg-red-700 text-white font-semibold text-xs font-mono flex items-center gap-1.5"
              >
                {clearingAll ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Purging Archives...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Yes, Purge Everything</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Single Record Detail Modal */}
      {selectedRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-zinc-950 border border-zinc-800 rounded-xl max-w-2xl w-full p-6 space-y-5 shadow-2xl relative max-h-[90vh] overflow-y-auto font-sans">
            <button
              onClick={() => setSelectedRecord(null)}
              className="absolute top-4 right-4 text-zinc-400 hover:text-white p-1 rounded-md border border-zinc-800 bg-zinc-900 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-zinc-900 border border-zinc-800 text-white">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-base font-bold text-white font-mono">
                    Case #{selectedRecord.id} &bull; {selectedRecord.equipment_type}
                  </h3>
                  {getUrgencyBadge(selectedRecord.urgency)}
                  {getStatusBadge(selectedRecord.status)}
                </div>
                <p className="text-xs text-zinc-400 font-mono mt-0.5">
                  Asset ID: {selectedRecord.equipment_id} &bull; Location: {selectedRecord.location}
                </p>
              </div>
            </div>

            {/* Original Complaint */}
            <div className="p-3.5 rounded-md bg-black border border-zinc-850">
              <span className="text-[10px] font-mono text-zinc-500 uppercase block mb-1">
                Reported Incident & Failure Symptoms
              </span>
              <p className="text-xs font-mono text-zinc-200">"{selectedRecord.complaint}"</p>
            </div>

            {/* Reporter & Origin Details if available */}
            {selectedRecord.technician_notes && (
              <div className="p-3 rounded-md bg-emerald-950/20 border border-emerald-800/40">
                <span className="text-[10px] font-mono text-emerald-400 uppercase font-bold block mb-1">
                  Incident Reporter & Audit Metadata
                </span>
                <p className="text-xs text-zinc-300 font-mono">
                  {selectedRecord.technician_notes}
                </p>
              </div>
            )}

            {/* Diagnosis & Root Cause */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-md bg-zinc-900/50 border border-zinc-800">
                <span className="text-zinc-500 text-[10px] font-mono uppercase block mb-1">
                  Root Cause Analysis
                </span>
                <p className="text-amber-300 font-medium">{selectedRecord.root_cause}</p>
              </div>

              <div className="p-3 rounded-md bg-zinc-900/50 border border-zinc-800">
                <span className="text-zinc-500 text-[10px] font-mono uppercase block mb-1">
                  Diagnosis Summary
                </span>
                <p className="text-zinc-200">{selectedRecord.diagnosis}</p>
              </div>
            </div>

            {/* Recommended Fix */}
            <div className="p-3.5 rounded-md bg-zinc-900/40 border border-zinc-800">
              <div className="flex items-center gap-2 text-emerald-400 text-xs font-mono font-semibold mb-1">
                <Wrench className="h-3.5 w-3.5" />
                <span>Verified Repair Procedure</span>
              </div>
              <p className="text-xs text-zinc-300 leading-relaxed font-sans">
                {selectedRecord.recommended_fix}
              </p>
            </div>

            {/* Metrics Row */}
            <div className="grid grid-cols-3 gap-3 p-3 rounded-md bg-black border border-zinc-850 font-mono text-xs">
              <div className="flex items-center gap-2">
                <IndianRupee className="h-4 w-4 text-zinc-400" />
                <div>
                  <span className="text-[10px] text-zinc-500 block">COST</span>
                  <span className="font-bold text-white">₹{selectedRecord.estimated_cost.toLocaleString('en-IN')}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-zinc-400" />
                <div>
                  <span className="text-[10px] text-zinc-500 block">TIME</span>
                  <span className="font-bold text-white">{selectedRecord.repair_time} Hours</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Boxes className="h-4 w-4 text-zinc-400" />
                <div>
                  <span className="text-[10px] text-zinc-500 block">TECHNICIAN</span>
                  <span className="font-bold text-zinc-300 text-[11px] truncate max-w-[110px]" title={selectedRecord.technician_type}>
                    {selectedRecord.technician_type}
                  </span>
                </div>
              </div>
            </div>

            {/* Action Bar */}
            <div className="flex items-center justify-between pt-3 border-t border-zinc-800 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedRecord(null)}
                  className="border-zinc-800 text-zinc-400 hover:text-white text-xs font-mono"
                >
                  Close
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleToggleResolve(selectedRecord)}
                  disabled={actionPendingId === selectedRecord.id}
                  className="border-emerald-900/60 bg-emerald-950/30 text-emerald-400 hover:bg-emerald-900/50 text-xs font-mono flex items-center gap-1.5"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>
                    {selectedRecord.status === 'Resolved' || selectedRecord.status === 'Completed'
                      ? 'Mark as Active'
                      : 'Mark as Resolved'}
                  </span>
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDeleteRecord(selectedRecord.id)}
                  disabled={actionPendingId === selectedRecord.id}
                  className="border-red-900/60 bg-red-950/20 text-red-400 hover:bg-red-900/40 text-xs font-mono flex items-center gap-1.5"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Delete Case</span>
                </Button>
              </div>

              <div className="flex items-center gap-2 ml-auto">
                {onInspectComplaint && selectedRecord.technician_notes && selectedRecord.technician_notes.includes('WO-') && (
                  <Button
                    size="sm"
                    onClick={() => {
                      const match = selectedRecord.technician_notes.match(/WO-(\d+)/);
                      if (match && match[1]) {
                        onInspectComplaint(parseInt(match[1], 10));
                        setSelectedRecord(null);
                      }
                    }}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs font-mono flex items-center gap-1.5"
                  >
                    <span>Inspect Decision Report</span>
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Button>
                )}

                {onLoadComplaintToAnalyze && (
                  <Button
                    size="sm"
                    onClick={() => {
                      onLoadComplaintToAnalyze(selectedRecord.complaint, selectedRecord.equipment_type);
                      setSelectedRecord(null);
                    }}
                    className="bg-white hover:bg-zinc-200 text-black font-semibold text-xs font-mono flex items-center gap-1.5"
                  >
                    <span>Re-Analyze</span>
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
