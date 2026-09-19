import React, { useState } from 'react';
import {
  CheckCircle2,
  Database,
  Loader2,
  ShieldAlert,
  ThumbsDown,
  ThumbsUp,
  X,
} from 'lucide-react';
import { Button } from './ui/Button';
import { submitTechnicianFeedback } from '../services/api';

interface FeedbackModalProps {
  complaintId: number;
  initialAccepted?: boolean;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (feedbackData: {
    accepted: boolean;
    technician_name: string;
    technician_feedback: string;
    corrected_diagnosis?: string;
    appended_to_kb: boolean;
  }) => void;
}

export const FeedbackModal: React.FC<FeedbackModalProps> = ({
  complaintId,
  initialAccepted = true,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [accepted, setAccepted] = useState<boolean>(initialAccepted);
  const [technicianName, setTechnicianName] = useState('Senior Technician Sharma');
  const [technicianFeedback, setTechnicianFeedback] = useState('');
  const [correctedDiagnosis, setCorrectedDiagnosis] = useState('');
  const [correctedFix, setCorrectedFix] = useState('');
  const [actualCost, setActualCost] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const res = await submitTechnicianFeedback({
        complaint_id: complaintId,
        accepted,
        technician_name: technicianName || 'Staff Technician',
        technician_feedback: technicianFeedback || (accepted ? 'Approved without modifications' : 'Diagnosis corrected on site'),
        corrected_diagnosis: !accepted ? correctedDiagnosis : undefined,
        corrected_fix: !accepted ? correctedFix : undefined,
        actual_cost: actualCost ? parseInt(actualCost, 10) : undefined,
      });

      onSuccess({
        accepted: res.accepted,
        technician_name: technicianName,
        technician_feedback: technicianFeedback,
        corrected_diagnosis: !accepted ? correctedDiagnosis : undefined,
        appended_to_kb: res.appended_to_kb,
      });
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to submit technician feedback');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-xl border border-border bg-card shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/60 p-4 bg-muted/20">
          <div className="flex items-center gap-2">
            <div className={`p-1.5 rounded-md ${accepted ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>
              {accepted ? <ThumbsUp className="h-4 w-4" /> : <ThumbsDown className="h-4 w-4" />}
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">
                {accepted ? 'Approve & Confirm Decision' : 'Correct Diagnosis & Action'}
              </h3>
              <p className="text-[11px] text-muted-foreground">
                Technician Review & Continuous Knowledge Learning Loop
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground p-1 rounded-md"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          {error && (
            <div className="p-3 rounded-md bg-destructive/15 border border-destructive/30 text-destructive-foreground flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Decision Choice Toggle */}
          <div className="space-y-1.5">
            <label className="font-medium text-foreground block">Review Verdict</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setAccepted(true)}
                className={`py-2 px-3 rounded-md border text-center font-medium transition-all flex items-center justify-center gap-1.5 ${
                  accepted
                    ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-400'
                    : 'border-border/60 bg-muted/20 text-muted-foreground hover:bg-muted/40'
                }`}
              >
                <ThumbsUp className="h-3.5 w-3.5" />
                Approve (Accurate)
              </button>
              <button
                type="button"
                onClick={() => setAccepted(false)}
                className={`py-2 px-3 rounded-md border text-center font-medium transition-all flex items-center justify-center gap-1.5 ${
                  !accepted
                    ? 'border-amber-500/50 bg-amber-500/15 text-amber-400'
                    : 'border-border/60 bg-muted/20 text-muted-foreground hover:bg-muted/40'
                }`}
              >
                <ThumbsDown className="h-3.5 w-3.5" />
                Mark Incorrect / Correct
              </button>
            </div>
          </div>

          {/* Technician Name */}
          <div className="space-y-1">
            <label className="font-medium text-foreground">Technician Name / ID</label>
            <input
              type="text"
              required
              value={technicianName}
              onChange={(e) => setTechnicianName(e.target.value)}
              className="w-full rounded-md border border-input bg-background/50 px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="e.g. Senior HVAC Engineer Verma"
            />
          </div>

          {/* If Rejected: Corrected Diagnosis and Fix */}
          {!accepted && (
            <div className="space-y-3 p-3 rounded-lg border border-amber-500/30 bg-amber-500/5">
              <div className="space-y-1">
                <label className="font-medium text-amber-300">Corrected Root Cause / Diagnosis *</label>
                <input
                  type="text"
                  required={!accepted}
                  value={correctedDiagnosis}
                  onChange={(e) => setCorrectedDiagnosis(e.target.value)}
                  className="w-full rounded-md border border-amber-500/30 bg-background px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-amber-500"
                  placeholder="e.g. Defective expansion valve, not blower fan"
                />
              </div>

              <div className="space-y-1">
                <label className="font-medium text-amber-300">Corrected Repair Action *</label>
                <input
                  type="text"
                  required={!accepted}
                  value={correctedFix}
                  onChange={(e) => setCorrectedFix(e.target.value)}
                  className="w-full rounded-md border border-amber-500/30 bg-background px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-amber-500"
                  placeholder="e.g. Replace thermal expansion valve and re-vacuum lines"
                />
              </div>
            </div>
          )}

          {/* Actual Cost & Duration */}
          <div className="space-y-1">
            <label className="font-medium text-foreground">Actual Incurred Cost in INR (₹) (Optional)</label>
            <input
              type="number"
              value={actualCost}
              onChange={(e) => setActualCost(e.target.value)}
              className="w-full rounded-md border border-input bg-background/50 px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="e.g. 2400"
            />
          </div>

          {/* Technician Observations */}
          <div className="space-y-1">
            <label className="font-medium text-foreground">Technician Field Notes</label>
            <textarea
              rows={2}
              value={technicianFeedback}
              onChange={(e) => setTechnicianFeedback(e.target.value)}
              className="w-full rounded-md border border-input bg-background/50 px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="e.g. Inspected coil on site. Balanced fan bearings and replaced capacitor."
            />
          </div>

          {/* Learning loop notice */}
          <div className="flex items-center gap-2 p-2.5 rounded-md bg-primary/10 border border-primary/20 text-[11px] text-muted-foreground">
            <Database className="h-4 w-4 text-primary shrink-0" />
            <span>
              Confirmed case will be <strong>dynamically appended to knowledge base & vector index</strong> to enhance future retrieval.
            </span>
          </div>

          {/* Submit Actions */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/40">
            <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting}
              className={accepted ? 'bg-emerald-600 hover:bg-emerald-500 text-white' : 'bg-amber-600 hover:bg-amber-500 text-white'}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  Updating Knowledge Base...
                </>
              ) : (
                <>
                  <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                  Save & Index to KB
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
