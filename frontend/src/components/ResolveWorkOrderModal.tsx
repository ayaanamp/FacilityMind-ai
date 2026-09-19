import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Banknote,
  CheckCircle2,
  HardHat,
  IndianRupee,
  Loader2,
  Phone,
  UserCheck,
  Wrench,
  X,
} from 'lucide-react';
import { Button } from './ui/Button';
import { fetchTechnicians, resolveWorkOrder } from '../services/api';
import { TechnicianStaff, WorkOrderItem } from '../types';

interface ResolveWorkOrderModalProps {
  isOpen: boolean;
  workOrder: WorkOrderItem | null;
  onClose: () => void;
  onSuccess: (message: string) => void;
}

export const ResolveWorkOrderModal: React.FC<ResolveWorkOrderModalProps> = ({
  isOpen,
  workOrder,
  onClose,
  onSuccess,
}) => {
  const [technicians, setTechnicians] = useState<TechnicianStaff[]>([]);
  const [selectedTechId, setSelectedTechId] = useState<number | ''>('');
  const [laborCost, setLaborCost] = useState<number>(850);
  const [partsCost, setPartsCost] = useState<number>(450);
  const [notes, setNotes] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [fetchingTechs, setFetchingTechs] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !workOrder) return;

    setError(null);
    setFetchingTechs(true);
    fetchTechnicians()
      .then((res) => {
        setTechnicians(res.technicians);
        if (res.technicians.length > 0) {
          // Select technician matching required role or default to first
          const matched = res.technicians.find((t) =>
            t.role.toLowerCase().includes(workOrder.technician_required.toLowerCase().split(' ')[0])
          );
          const activeTech = matched || res.technicians[0];
          setSelectedTechId(activeTech.id);
          setLaborCost(activeTech.per_job_rate || 800);
        }
      })
      .catch((err) => {
        setError('Failed to load technician roster: ' + err.message);
      })
      .finally(() => {
        setFetchingTechs(false);
      });

    // Default estimate splits
    const est = workOrder.estimated_cost || 1500;
    setLaborCost(Math.round(est * 0.45));
    setPartsCost(Math.round(est * 0.55));
    setNotes(`Completed maintenance on ${workOrder.equipment_type} at ${workOrder.location}. Verified functional.`);
  }, [isOpen, workOrder]);

  if (!isOpen || !workOrder) return null;

  const handleTechChange = (techIdStr: string) => {
    const id = Number(techIdStr);
    setSelectedTechId(id);
    const tech = technicians.find((t) => t.id === id);
    if (tech) {
      setLaborCost(tech.per_job_rate || 800);
    }
  };

  const selectedTech = technicians.find((t) => t.id === selectedTechId);
  const totalActualCost = Number(laborCost || 0) + Number(partsCost || 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTechId) {
      setError('Please select the technician / worker who repaired this asset.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await resolveWorkOrder(workOrder.complaint_id, {
        assigned_technician_id: Number(selectedTechId),
        assigned_technician_name: selectedTech?.name || 'Assigned Technician',
        labor_cost: Number(laborCost || 0),
        parts_cost: Number(partsCost || 0),
        notes,
      });

      onSuccess(
        `Order ${workOrder.work_order_code} resolved. ₹${laborCost} labor credited to ${selectedTech?.name || 'Technician'}.`
      );
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to resolve work order');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl rounded-xl border border-zinc-700/80 bg-zinc-950 p-6 shadow-2xl text-white font-mono space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-zinc-800 pb-3">
          <div>
            <div className="flex items-center gap-2 text-zinc-400 text-xs font-mono uppercase tracking-wider mb-0.5">
              <UserCheck className="h-4 w-4 text-emerald-400" />
              <span>Job Completion & Labor Settlement</span>
            </div>
            <h3 className="text-lg font-bold text-white font-mono flex items-center gap-2">
              <span>Resolve Work Order</span>
              <span className="text-xs px-2 py-0.5 rounded bg-zinc-800 text-emerald-400 border border-emerald-800/60">
                {workOrder.work_order_code}
              </span>
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg border border-transparent hover:border-zinc-700 text-zinc-400 hover:text-white transition-all"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-md bg-red-950/40 border border-red-900 text-red-300 text-xs flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Complaint Overview Card */}
        <div className="p-3.5 rounded-lg bg-zinc-900/60 border border-zinc-800 space-y-2 text-xs">
          <div className="flex justify-between items-center text-zinc-400 border-b border-zinc-800/80 pb-1.5">
            <span className="font-semibold text-white">{workOrder.equipment_type}</span>
            <span>{workOrder.location}</span>
          </div>
          <p className="text-zinc-300 text-[11px] line-clamp-2">
            &ldquo;{workOrder.symptoms}&rdquo;
          </p>
          <div className="flex items-center justify-between text-[11px] text-zinc-400 pt-1 font-mono">
            <span>Reported By: {workOrder.reporter_name}</span>
            <span>Target Tech: {workOrder.technician_required}</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Worker / Servant Selection */}
          <div className="space-y-1.5">
            <label className="font-semibold text-zinc-200 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <HardHat className="h-3.5 w-3.5 text-amber-400" />
                Select Worker Who Repaired *
              </span>
              {selectedTech && (
                <span className="text-[10px] text-emerald-400 flex items-center gap-1">
                  <Phone className="h-3 w-3" />
                  {selectedTech.phone}
                </span>
              )}
            </label>

            {fetchingTechs ? (
              <div className="p-3 text-center text-zinc-400 text-xs flex items-center justify-center gap-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Loading technicians roster...</span>
              </div>
            ) : (
              <select
                value={selectedTechId}
                onChange={(e) => handleTechChange(e.target.value)}
                required
                className="w-full rounded-md border border-zinc-700 bg-black px-3 py-2.5 text-white focus:outline-none focus:border-white text-xs"
              >
                {technicians.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} — {t.role} (Rate: ₹{t.per_job_rate}/job | Phone: {t.phone})
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Money Management: Labor Fee + Replacement Parts */}
          <div className="grid grid-cols-2 gap-3 p-3.5 rounded-lg bg-zinc-900/40 border border-zinc-800">
            {/* Labor Payout */}
            <div className="space-y-1">
              <label className="font-semibold text-zinc-300 flex items-center gap-1">
                <Banknote className="h-3.5 w-3.5 text-emerald-400" />
                <span>Worker Labor Fee (₹) *</span>
              </label>
              <div className="relative">
                <span className="absolute left-2.5 top-2 text-zinc-500 text-xs">₹</span>
                <input
                  type="number"
                  min="0"
                  required
                  value={laborCost}
                  onChange={(e) => setLaborCost(Number(e.target.value))}
                  className="w-full rounded-md border border-zinc-700 bg-black pl-6 pr-3 py-2 text-white focus:outline-none focus:border-emerald-400 text-xs font-mono"
                />
              </div>
              <span className="text-[10px] text-zinc-500 block">Credited to worker salary balance</span>
            </div>

            {/* Parts / Hardware Material Cost */}
            <div className="space-y-1">
              <label className="font-semibold text-zinc-300 flex items-center gap-1">
                <Wrench className="h-3.5 w-3.5 text-sky-400" />
                <span>Parts & Materials (₹)</span>
              </label>
              <div className="relative">
                <span className="absolute left-2.5 top-2 text-zinc-500 text-xs">₹</span>
                <input
                  type="number"
                  min="0"
                  value={partsCost}
                  onChange={(e) => setPartsCost(Number(e.target.value))}
                  className="w-full rounded-md border border-zinc-700 bg-black pl-6 pr-3 py-2 text-white focus:outline-none focus:border-sky-400 text-xs font-mono"
                />
              </div>
              <span className="text-[10px] text-zinc-500 block">Hardware / consumable outlay</span>
            </div>
          </div>

          {/* Real-time Total Spend Banner */}
          <div className="p-3 rounded-lg bg-zinc-900 border border-zinc-700 flex items-center justify-between">
            <div>
              <span className="text-[11px] text-zinc-400 uppercase tracking-wider block">Grand Total Job Spend</span>
              <span className="text-[10px] text-zinc-500 font-mono">
                Labor ₹{laborCost} + Parts ₹{partsCost}
              </span>
            </div>
            <div className="text-right">
              <span className="text-xl font-bold font-mono text-emerald-400 flex items-center justify-end">
                <IndianRupee className="h-4 w-4 inline" />
                {totalActualCost.toLocaleString()}
              </span>
              <span className="text-[10px] text-zinc-400">Total Facility Outlay</span>
            </div>
          </div>

          {/* Technician Work Notes */}
          <div className="space-y-1">
            <label className="font-semibold text-zinc-300">Technician Sign-Off & Verification Notes</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Cleared refrigerant leak, tightened electrical terminals, tested under 30-minute load."
              className="w-full rounded-md border border-zinc-700 bg-black px-3 py-2 text-white focus:outline-none focus:border-white text-xs font-mono"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-zinc-800">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={loading}
              className="border-zinc-700 hover:border-zinc-500 text-zinc-400 hover:text-white text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={loading}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-mono text-xs font-bold px-4 flex items-center gap-1.5 active:scale-[0.98] transition-all"
            >
              {loading ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Settling...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>Complete & Settle Labor</span>
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
