import React, { useState } from 'react';
import {
  Boxes,
  Clock,
  IndianRupee,
  Loader2,
  Plus,
  Sparkles,
  X,
} from 'lucide-react';
import { Button } from './ui/Button';
import { createMaintenanceRecord } from '../services/api';

interface AddEquipmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newCategory: string) => void;
}

export const AddEquipmentModal: React.FC<AddEquipmentModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [equipmentType, setEquipmentType] = useState('');
  const [equipmentId, setEquipmentId] = useState('');
  const [location, setLocation] = useState('Academic Main Block');
  const [complaint, setComplaint] = useState('');
  const [symptoms, setSymptoms] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [rootCause, setRootCause] = useState('');
  const [recommendedFix, setRecommendedFix] = useState('');
  const [estimatedCost, setEstimatedCost] = useState(1500);
  const [repairTime, setRepairTime] = useState(1.5);
  const [urgency, setUrgency] = useState('Medium');
  const [technicianType, setTechnicianType] = useState('Plumber / Facility Tech');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!equipmentType.trim() || !complaint.trim() || !recommendedFix.trim()) {
      setError('Please provide Equipment Category, Baseline Failure, and Recommended Fix.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await createMaintenanceRecord({
        equipment_type: equipmentType.trim(),
        equipment_id: equipmentId.trim() || `${equipmentType.substring(0, 3).toUpperCase()}-01`,
        location: location.trim() || 'Campus Facility',
        complaint: complaint.trim(),
        symptoms: symptoms.trim() || complaint.trim(),
        diagnosis: diagnosis.trim() || `Diagnostic procedure for ${equipmentType.trim()}`,
        root_cause: rootCause.trim() || 'Component wear or operational fatigue',
        recommended_fix: recommendedFix.trim(),
        estimated_cost: Number(estimatedCost) || 1500,
        repair_time: Number(repairTime) || 1.5,
        urgency: urgency,
        technician_type: technicianType.trim() || 'Facility Specialist',
        technician_notes: 'Defined via Admin Diagnostic Taxonomy Manager',
      });

      onSuccess(equipmentType.trim());
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to register equipment taxonomy.');
    } finally {
      setLoading(false);
    }
  };

  const loadPreset = (category: string, comp: string, cause: string, fix: string, tech: string, cost: number) => {
    setEquipmentType(category);
    setEquipmentId(`${category.substring(0, 3).toUpperCase()}-101`);
    setComplaint(comp);
    setSymptoms(comp);
    setDiagnosis(`Verified malfunction in ${category}`);
    setRootCause(cause);
    setRecommendedFix(fix);
    setTechnicianType(tech);
    setEstimatedCost(cost);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className="bg-zinc-950 border border-zinc-800 rounded-xl max-w-2xl w-full p-6 space-y-5 shadow-2xl relative max-h-[90vh] overflow-y-auto font-sans">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-zinc-400 hover:text-white p-1.5 rounded-lg border border-zinc-800 bg-zinc-900 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Modal Header */}
        <div className="flex items-start gap-3 border-b border-zinc-850 pb-4">
          <div className="p-2.5 rounded-lg bg-zinc-900 border border-zinc-750 text-white">
            <Boxes className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white font-mono flex items-center gap-2">
              Define Diagnostic Equipment Taxonomy
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-850 text-zinc-300 border border-zinc-700 uppercase">
                Admin
              </span>
            </h3>
            <p className="text-xs text-zinc-400 mt-0.5">
              Add new infrastructure categories (e.g. Washrooms/Plumbing, Lighting, Lab Hardware) with baseline diagnostic rules and vector embeddings.
            </p>
          </div>
        </div>

        {/* Quick Presets */}
        <div className="space-y-1.5">
          <span className="text-[11px] font-mono text-zinc-400 flex items-center gap-1.5">
            <Sparkles className="h-3 w-3 text-zinc-300" />
            Quick One-Click Category Presets:
          </span>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() =>
                loadPreset(
                  'Restroom / Washroom Plumbing',
                  'Water continuously leaking from flush valve into commode tank with low pressure in wash basin tap',
                  'Worn silicone flush seal ring and mineral scale obstruction in inlet strainer',
                  'Disassemble flush valve assembly, replace silicone seal ring, de-scale inlet pipe and calibrate water level float',
                  'Plumber / Sanitation Specialist',
                  1200
                )
              }
              className="text-[11px] font-mono px-2.5 py-1 rounded bg-zinc-900 border border-zinc-800 hover:border-zinc-600 text-zinc-300 transition-all text-left"
            >
              + Washrooms / Plumbing
            </button>
            <button
              type="button"
              onClick={() =>
                loadPreset(
                  'Lighting & Electrical Fixtures',
                  'Fluorescent LED tube light fixture flickering violently and humming in lecture hallway',
                  'Degraded electronic LED driver capacitor and loose neutral connection in junction box',
                  'Isolate power circuit, replace internal LED driver ballast unit, secure neutral wire terminal with insulated sleeve',
                  'Campus Electrician',
                  850
                )
              }
              className="text-[11px] font-mono px-2.5 py-1 rounded bg-zinc-900 border border-zinc-800 hover:border-zinc-600 text-zinc-300 transition-all text-left"
            >
              + Lighting & Fixtures
            </button>
            <button
              type="button"
              onClick={() =>
                loadPreset(
                  'Laboratory Equipment',
                  'Laminar air flow clean bench blower motor vibrating with low face velocity alarm',
                  'Pre-filter particulate loading exceeding 90% and worn blower motor rubber vibration damper mounts',
                  'Replace secondary intake pre-filters, re-torque motor rubber isolator mounts, measure air velocity with anemometer',
                  'Lab Systems Technician',
                  3200
                )
              }
              className="text-[11px] font-mono px-2.5 py-1 rounded bg-zinc-900 border border-zinc-800 hover:border-zinc-600 text-zinc-300 transition-all text-left"
            >
              + Laboratory Systems
            </button>
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-red-950/40 border border-red-900/60 text-red-300 text-xs">
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4 text-xs font-sans">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-zinc-300 font-semibold font-mono">
                Equipment Category Name *
              </label>
              <input
                type="text"
                required
                value={equipmentType}
                onChange={(e) => setEquipmentType(e.target.value)}
                placeholder="e.g. Restroom / Washroom Plumbing"
                className="w-full rounded-md border border-zinc-800 bg-black px-3 py-2 text-white placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500 font-mono text-xs"
              />
            </div>

            <div className="space-y-1">
              <label className="text-zinc-300 font-semibold font-mono">
                Sample Asset ID / Code
              </label>
              <input
                type="text"
                value={equipmentId}
                onChange={(e) => setEquipmentId(e.target.value)}
                placeholder="e.g. WSH-101"
                className="w-full rounded-md border border-zinc-800 bg-black px-3 py-2 text-white placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500 font-mono text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-zinc-300 font-semibold font-mono">Facility Location</label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. Science Block 1st Floor Restrooms"
                className="w-full rounded-md border border-zinc-800 bg-black px-3 py-2 text-white placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500 font-mono text-xs"
              />
            </div>

            <div className="space-y-1">
              <label className="text-zinc-300 font-semibold font-mono">Technician Trade Assignment</label>
              <input
                type="text"
                value={technicianType}
                onChange={(e) => setTechnicianType(e.target.value)}
                placeholder="e.g. Plumber / Sanitary Mechanic"
                className="w-full rounded-md border border-zinc-800 bg-black px-3 py-2 text-white placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500 font-mono text-xs"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-zinc-300 font-semibold font-mono">
              Baseline Incident / Symptom Description *
            </label>
            <input
              type="text"
              required
              value={complaint}
              onChange={(e) => setComplaint(e.target.value)}
              placeholder="e.g. Flush valve continuous water leak and low pressure in wash basin"
              className="w-full rounded-md border border-zinc-800 bg-black px-3 py-2 text-white placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500 font-mono text-xs"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-zinc-300 font-semibold font-mono">Root Cause Diagnostic Pattern *</label>
              <input
                type="text"
                required
                value={rootCause}
                onChange={(e) => setRootCause(e.target.value)}
                placeholder="e.g. Flush tank seal degradation and limescale deposit"
                className="w-full rounded-md border border-zinc-800 bg-black px-3 py-2 text-white placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500 font-mono text-xs"
              />
            </div>

            <div className="space-y-1">
              <label className="text-zinc-300 font-semibold font-mono">Severity Level</label>
              <select
                value={urgency}
                onChange={(e) => setUrgency(e.target.value)}
                className="w-full rounded-md border border-zinc-800 bg-black px-3 py-2 text-white focus:outline-none focus:border-zinc-500 font-mono text-xs"
              >
                <option value="Low">Low (General Maintenance)</option>
                <option value="Medium">Medium (Operational Disruption)</option>
                <option value="High">High (Immediate Action Required)</option>
                <option value="Critical">Critical (Health/Safety Hazard)</option>
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-zinc-300 font-semibold font-mono">
              Standard Operating Repair Procedure *
            </label>
            <textarea
              rows={3}
              required
              value={recommendedFix}
              onChange={(e) => setRecommendedFix(e.target.value)}
              placeholder="e.g. Isolate main valve, dismantle flush valve, replace silicone seal, clear mineral scale, test at 2.5 bar"
              className="w-full rounded-md border border-zinc-800 bg-black p-2.5 text-white placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500 font-mono text-xs"
            />
          </div>

          <div className="grid grid-cols-2 gap-3 font-mono">
            <div className="space-y-1">
              <label className="text-zinc-400 text-[11px]">BENCHMARK COST (₹)</label>
              <div className="relative">
                <IndianRupee className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-zinc-500" />
                <input
                  type="number"
                  value={estimatedCost}
                  onChange={(e) => setEstimatedCost(Number(e.target.value))}
                  className="w-full rounded-md border border-zinc-800 bg-black pl-8 pr-3 py-2 text-white focus:outline-none focus:border-zinc-500 text-xs"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-zinc-400 text-[11px]">REPAIR TIME (HOURS)</label>
              <div className="relative">
                <Clock className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-zinc-500" />
                <input
                  type="number"
                  step="0.1"
                  value={repairTime}
                  onChange={(e) => setRepairTime(Number(e.target.value))}
                  className="w-full rounded-md border border-zinc-800 bg-black pl-8 pr-3 py-2 text-white focus:outline-none focus:border-zinc-500 text-xs"
                />
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-850">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={loading}
              className="border-zinc-800 text-zinc-400 hover:text-white text-xs"
            >
              Cancel
            </Button>

            <Button
              type="submit"
              disabled={loading}
              className="bg-white hover:bg-zinc-200 text-black font-semibold text-xs px-5 flex items-center gap-1.5 transition-all shadow-sm"
            >
              {loading ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Registering & Vector Indexing...
                </>
              ) : (
                <>
                  <Plus className="h-3.5 w-3.5" />
                  Register Equipment Taxonomy
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
