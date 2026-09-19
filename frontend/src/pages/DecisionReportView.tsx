import React, { useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  Database,
  DollarSign,
  ExternalLink,
  FileText,
  Printer,
  Shield,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  UserCheck,
  Wrench,
  X,
  Zap,
  Rocket,
  BookOpen,
  Users,
  PlusCircle,
  Sparkles,
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { FeedbackModal } from '../components/FeedbackModal';
import { DecisionReport, SimilarCase } from '../types';
import { deleteComplaint, rateDiagnosisAccuracy } from '../services/api';

interface DecisionReportViewProps {
  decision: DecisionReport | null;
  onNewComplaint: () => void;
  onExploreSimilar: (query: string, equipment?: string) => void;
  onDeleteComplaint?: (complaintId: number) => void;
  onNavigateTab?: (tab: string) => void;
}

export const DecisionReportView: React.FC<DecisionReportViewProps> = ({
  decision,
  onNewComplaint,
  onExploreSimilar,
  onDeleteComplaint,
  onNavigateTab,
}) => {
  const [feedbackModalOpen, setFeedbackModalOpen] = useState(false);
  const [initialFeedbackAccepted, setInitialFeedbackAccepted] = useState(true);
  const [localDecision, setLocalDecision] = useState<DecisionReport | null>(decision);
  const [selectedCase, setSelectedCase] = useState<SimilarCase | null>(null);
  const [userRating, setUserRating] = useState<number | null>(null);
  const [ratingMessage, setRatingMessage] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showPostApprovalModal, setShowPostApprovalModal] = useState(false);
  const [approvalType, setApprovalType] = useState<'diagnosis' | 'technician'>('diagnosis');


  React.useEffect(() => {
    setLocalDecision(decision);
    setUserRating(null);
    setRatingMessage(null);
  }, [decision]);

  if (!localDecision) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center space-y-4 text-center">
        <div className="h-12 w-12 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400">
          <FileText className="h-6 w-6" />
        </div>
        <div className="space-y-1">
          <h3 className="text-base font-semibold text-white font-mono">No Active Decision Loaded</h3>
          <p className="text-xs text-zinc-400 max-w-sm font-mono">
            Submit a maintenance complaint or launch a 1-click demo scenario to generate an evidence-backed decision report.
          </p>
        </div>
        <Button onClick={onNewComplaint} size="sm" className="bg-white text-black hover:bg-zinc-200 font-mono text-xs">
          Analyze New Complaint
        </Button>
      </div>
    );
  }

  const {
    complaint_id,
    raw_complaint,
    created_at,
    analysis,
    similar_cases,
    diagnosis,
    recommendation,
    explanation,
    agent_runs,
    is_fallback,
    human_verified,
    technician_feedback,
  } = localDecision;

  const handleRating = async (rating: number) => {
    setUserRating(rating);
    try {
      await rateDiagnosisAccuracy(complaint_id, rating);
      if (rating === 1) {
        setRatingMessage('Diagnosis rated accurate. Model confidence reinforced.');
        setApprovalType('diagnosis');
        setShowPostApprovalModal(true);
      } else {
        setRatingMessage('Feedback noted. Flagged for review by Chief Facility Engineer.');
      }
    } catch {
      if (rating === 1) {
        setRatingMessage('Accuracy confirmed (offline mode).');
        setApprovalType('diagnosis');
        setShowPostApprovalModal(true);
      } else {
        setRatingMessage('Correction noted (offline mode).');
      }
    }
    setTimeout(() => setRatingMessage(null), 5000);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDeleteReport = async () => {
    if (!complaint_id) return;
    setIsDeleting(true);
    try {
      await deleteComplaint(complaint_id);
      if (onDeleteComplaint) {
        onDeleteComplaint(complaint_id);
      } else {
        onNewComplaint();
      }
    } catch (err: any) {
      alert(`Failed to delete complaint: ${err?.message || 'Unknown error'}`);
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleFeedbackSuccess = (fbData: {
    accepted: boolean;
    technician_name: string;
    technician_feedback: string;
    corrected_diagnosis?: string;
    appended_to_kb: boolean;
  }) => {
    setLocalDecision((prev) =>
      prev
        ? {
            ...prev,
            human_verified: true,
            status: fbData.accepted ? 'Verified & Closed' : 'Technician Corrected',
            technician_feedback: fbData,
          }
        : null
    );
    setApprovalType('technician');
    setShowPostApprovalModal(true);
  };

  const getUrgencyBadge = (urgency: string) => {
    switch (urgency) {
      case 'Critical':
        return <Badge className="bg-red-950 text-red-400 border border-red-800 font-mono text-[10px]">{urgency}</Badge>;
      case 'High':
        return <Badge className="bg-amber-950 text-amber-400 border border-amber-800 font-mono text-[10px]">{urgency}</Badge>;
      case 'Low':
        return <Badge className="bg-emerald-950 text-emerald-400 border border-emerald-800 font-mono text-[10px]">{urgency}</Badge>;
      default:
        return <Badge className="bg-zinc-800 text-zinc-300 border border-zinc-700 font-mono text-[10px]">{urgency}</Badge>;
    }
  };

  const getConfidenceBadge = (confidence: string) => {
    if (confidence.includes('High')) {
      return (
        <Badge className="bg-emerald-950 text-emerald-400 border border-emerald-800 font-mono text-xs">
          {confidence}
        </Badge>
      );
    }
    if (confidence.includes('Moderate')) {
      return (
        <Badge className="bg-zinc-800 text-zinc-200 border border-zinc-600 font-mono text-xs">
          {confidence}
        </Badge>
      );
    }
    return (
      <Badge className="bg-amber-950 text-amber-400 border border-amber-800 font-mono text-xs">
        {confidence}
      </Badge>
    );
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto animate-in fade-in duration-300 pb-16 print-page">
      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-950 border border-red-900/60 rounded-xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-red-400">
              <div className="p-2 rounded-lg bg-red-950/60 border border-red-800/80">
                <Trash2 className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-white">Permanently Delete Report #{complaint_id}?</h3>
            </div>
            <p className="text-xs text-zinc-400 leading-relaxed">
              This will remove Complaint #{complaint_id} ({analysis.equipment_type} at {analysis.location}) and its associated dispatch record from the live database.
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isDeleting}
                className="border-zinc-800 text-zinc-300 hover:bg-zinc-900 text-xs font-mono"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleDeleteReport}
                disabled={isDeleting}
                className="bg-red-600 hover:bg-red-500 text-white text-xs font-mono flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                {isDeleting ? 'Deleting...' : 'Confirm Delete'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Top Banner & Actions (Hidden during print) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800 pb-4 no-print">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-zinc-900 text-zinc-300 border border-zinc-700">
              Decision Report #{complaint_id}
            </span>
            <span className="text-xs text-zinc-400 font-mono">
              {new Date(created_at).toLocaleString()}
            </span>
            {is_fallback && (
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-950/60 text-amber-400 border border-amber-800">
                Evidence Fallback Mode
              </span>
            )}
          </div>
          <h1 className="text-xl sm:text-2xl font-bold font-mono tracking-tight text-white mt-1">
            {analysis.equipment_type} ({analysis.equipment_id}) — {analysis.location}
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Export to Printer-Friendly PDF Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrint}
            className="text-xs font-mono border-zinc-700 bg-zinc-900 hover:bg-zinc-800 text-white flex items-center gap-1.5 shadow-sm"
          >
            <Printer className="h-3.5 w-3.5 text-zinc-300" />
            <span>Export to PDF / Print</span>
          </Button>

          {/* Delete Report Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowDeleteConfirm(true)}
            className="text-xs font-mono border-red-900/60 bg-red-950/30 hover:bg-red-950/60 text-red-400 hover:text-red-300 flex items-center gap-1.5 shadow-sm"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>Delete</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={onNewComplaint}
            className="text-xs font-mono border-zinc-800 bg-zinc-950 hover:bg-zinc-900 text-zinc-300"
          >
            New Complaint
          </Button>

          <Button
            size="sm"
            onClick={() => {
              setInitialFeedbackAccepted(true);
              setFeedbackModalOpen(true);
            }}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-mono text-xs flex items-center gap-1.5 shadow-sm"
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            Technician Review
          </Button>
        </div>
      </div>


      {/* Printer Official Letterhead (Visible in Print Mode) */}
      <div className="hidden print:block mb-6 border-b border-black pb-4 text-black">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold font-mono tracking-tight">FACILITYMIND AI — INFRASTRUCTURE DECISION REPORT</h1>
            <p className="text-xs font-mono text-zinc-600">Smart Campus Decision-Support & Autonomous Work Order Dispatch</p>
          </div>
          <div className="text-right font-mono text-xs">
            <p><strong>REPORT ID:</strong> #{complaint_id}</p>
            <p><strong>TIMESTAMP:</strong> {new Date(created_at).toLocaleString()}</p>
          </div>
        </div>
      </div>

      {/* Thumbs Up / Down Diagnosis Accuracy Rating Pill */}
      <div className="p-3.5 rounded-lg border border-zinc-850 bg-zinc-950/80 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 no-print">
        <div className="flex items-center gap-2.5">
          <Shield className="h-4 w-4 text-zinc-400 shrink-0" />
          <span className="text-zinc-300 font-mono">
            <strong>Diagnosis Accuracy Assessment:</strong> Did the AI accurately infer the root cause and repair scope?
          </span>
        </div>

        <div className="flex items-center gap-2">
          {ratingMessage && (
            <span className="text-[11px] font-mono text-emerald-400 mr-2 animate-in fade-in duration-150">
              {ratingMessage}
            </span>
          )}
          <button
            onClick={() => handleRating(1)}
            className={`px-3 py-1.5 rounded-md font-mono text-xs flex items-center gap-1.5 transition-all border ${
              userRating === 1
                ? 'bg-emerald-950 text-emerald-400 border-emerald-600'
                : 'bg-zinc-900 text-zinc-300 hover:text-white border-zinc-700 hover:bg-zinc-800'
            }`}
            title="Mark AI Diagnosis as Accurate"
          >
            <ThumbsUp className="h-3.5 w-3.5 text-emerald-400" />
            <span>Accurate</span>
          </button>
          <button
            onClick={() => handleRating(-1)}
            className={`px-3 py-1.5 rounded-md font-mono text-xs flex items-center gap-1.5 transition-all border ${
              userRating === -1
                ? 'bg-red-950 text-red-400 border-red-600'
                : 'bg-zinc-900 text-zinc-300 hover:text-white border-zinc-700 hover:bg-zinc-800'
            }`}
            title="Mark AI Diagnosis as Inaccurate / Needs Adjustment"
          >
            <ThumbsDown className="h-3.5 w-3.5 text-red-400" />
            <span>Inaccurate</span>
          </button>
        </div>
      </div>

      {/* Human Verification Alert Pill */}
      {human_verified && technician_feedback ? (
        <div className="p-3.5 rounded-lg border border-emerald-800/80 bg-emerald-950/30 text-emerald-300 text-xs flex items-start gap-3">
          <UserCheck className="h-5 w-5 shrink-0 mt-0.5 text-emerald-400" />
          <div className="space-y-0.5 font-mono">
            <p className="font-semibold text-emerald-200">
              Verified by On-Duty Technician: {technician_feedback.technician_name} ({technician_feedback.accepted ? 'Approved AI Prescription' : 'Corrected Diagnosis'})
            </p>
            <p className="text-[11px] text-emerald-300/80">
              {technician_feedback.technician_feedback} &bull; Case appended to Knowledge Base for dynamic retrieval learning.
            </p>
          </div>
        </div>
      ) : (
        <div className="p-3 rounded-lg border border-zinc-850 bg-zinc-950 text-zinc-400 text-xs flex items-center justify-between no-print">
          <div className="flex items-center gap-2 font-mono">
            <Shield className="h-4 w-4 text-zinc-400 shrink-0" />
            <span>
              <strong>Human-in-the-Loop Protocol:</strong> AI-supported inference. On-site technician confirmation recommended before execution.
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => {
                setInitialFeedbackAccepted(true);
                setFeedbackModalOpen(true);
              }}
              className="px-2.5 py-1 rounded bg-emerald-950/80 text-emerald-400 border border-emerald-800 hover:bg-emerald-900 text-[11px] font-mono flex items-center gap-1"
            >
              <ThumbsUp className="h-3 w-3" /> Approve
            </button>
            <button
              onClick={() => {
                setInitialFeedbackAccepted(false);
                setFeedbackModalOpen(true);
              }}
              className="px-2.5 py-1 rounded bg-amber-950/80 text-amber-400 border border-amber-800 hover:bg-amber-900 text-[11px] font-mono flex items-center gap-1"
            >
              <ThumbsDown className="h-3 w-3" /> Correct
            </button>
          </div>
        </div>
      )}

      {/* Row 1: Complaint Extraction vs Diagnosis Reasoning */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Card 1: Complaint Parameters */}
        <Card className="border-zinc-800 bg-zinc-950/80 print-card">
          <CardHeader className="pb-3 border-b border-zinc-900">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold font-mono text-white flex items-center gap-2">
                <FileText className="h-4 w-4 text-zinc-300" />
                Raw Complaint & Agent Extraction
              </CardTitle>
              {getUrgencyBadge(analysis.severity)}
            </div>
          </CardHeader>
          <CardContent className="space-y-3 pt-3 text-xs">
            <div className="p-3 rounded-md bg-black/60 border border-zinc-900 font-mono text-zinc-300">
              <span className="text-zinc-500 block text-[10px] uppercase mb-1">Raw User Intake:</span>
              "{raw_complaint}"
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs font-mono">
              <div className="p-2 rounded bg-zinc-900/60 border border-zinc-850">
                <span className="text-zinc-500 block text-[10px]">EQUIPMENT:</span>
                <span className="font-semibold text-white">{analysis.equipment_type}</span>
              </div>
              <div className="p-2 rounded bg-zinc-900/60 border border-zinc-850">
                <span className="text-zinc-500 block text-[10px]">ASSET IDENTIFIER:</span>
                <span className="font-semibold text-white">{analysis.equipment_id}</span>
              </div>
              <div className="p-2 rounded bg-zinc-900/60 border border-zinc-850">
                <span className="text-zinc-500 block text-[10px]">LOCATION:</span>
                <span className="font-semibold text-white">{analysis.location}</span>
              </div>
              <div className="p-2 rounded bg-zinc-900/60 border border-zinc-850">
                <span className="text-zinc-500 block text-[10px]">INITIAL SEVERITY:</span>
                <span className="font-semibold text-white">{analysis.severity}</span>
              </div>
            </div>

            <div className="p-2.5 rounded bg-zinc-900/60 border border-zinc-850 font-mono">
              <span className="text-zinc-500 block text-[10px]">EXTRACTED SYMPTOMS:</span>
              <span className="text-zinc-300">{analysis.symptoms}</span>
            </div>
          </CardContent>
        </Card>

        {/* Card 2: AI Diagnosis Reasoning */}
        <Card className="border-zinc-800 bg-zinc-950/80 print-card">
          <CardHeader className="pb-3 border-b border-zinc-900">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold font-mono text-white flex items-center gap-2">
                <Zap className="h-4 w-4 text-amber-400" />
                Root Cause Diagnosis & Evidence Confidence
              </CardTitle>
              {getConfidenceBadge(diagnosis.confidence_level)}
            </div>
          </CardHeader>
          <CardContent className="space-y-3 pt-3 text-xs">
            <div className="p-3 rounded-md bg-zinc-900/80 border border-zinc-700/80 space-y-1">
              <span className="text-[10px] font-mono uppercase text-zinc-400 block">Probable Root Cause:</span>
              <p className="text-sm font-bold text-white font-mono">{diagnosis.primary_cause}</p>
            </div>

            <div className="space-y-1 font-mono">
              <span className="text-[10px] uppercase text-zinc-500 block">Reasoning Synthesis:</span>
              <p className="text-xs text-zinc-300 leading-relaxed bg-black/40 p-2.5 rounded border border-zinc-900">
                {diagnosis.reasoning_summary}
              </p>
            </div>

            {diagnosis.possible_causes && diagnosis.possible_causes.length > 0 && (
              <div className="space-y-1 font-mono">
                <span className="text-[10px] uppercase text-zinc-500 block">Alternative Potential Factors:</span>
                <ul className="list-disc list-inside space-y-1 text-[11px] text-zinc-400">
                  {diagnosis.possible_causes.map((cause, i) => (
                    <li key={i}>{cause}</li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Row 2: Action Prescription, Financials & Steps */}
      <Card className="border-zinc-800 bg-zinc-950/80 print-card">
        <CardHeader className="pb-3 border-b border-zinc-900">
          <CardTitle className="text-sm font-semibold font-mono text-white flex items-center gap-2">
            <Wrench className="h-4 w-4 text-emerald-400" />
            Action Prescription, Cost Estimates & Resource Allocation
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5 pt-4">
          {/* Key Resource Indicators Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
            <div className="p-3 rounded-lg border border-zinc-800 bg-zinc-900/60 space-y-1">
              <span className="text-zinc-500 text-[10px] block flex items-center gap-1">
                <DollarSign className="h-3 w-3 text-zinc-300" /> ESTIMATED COST (₹)
              </span>
              <span className="text-base font-bold text-white">
                ₹{recommendation.estimated_cost_min.toLocaleString('en-IN')} – ₹{recommendation.estimated_cost_max.toLocaleString('en-IN')}
              </span>
            </div>

            <div className="p-3 rounded-lg border border-zinc-800 bg-zinc-900/60 space-y-1">
              <span className="text-zinc-500 text-[10px] block flex items-center gap-1">
                <Clock className="h-3 w-3 text-amber-400" /> REPAIR DURATION
              </span>
              <span className="text-base font-bold text-white">
                ~{recommendation.repair_time_hours} Hours
              </span>
            </div>

            <div className="p-3 rounded-lg border border-zinc-800 bg-zinc-900/60 space-y-1">
              <span className="text-zinc-500 text-[10px] block flex items-center gap-1">
                <UserCheck className="h-3 w-3 text-emerald-400" /> ASSIGNED TECHNICIAN
              </span>
              <span className="text-xs font-bold text-emerald-400 truncate block">
                {recommendation.technician_required}
              </span>
            </div>

            <div className="p-3 rounded-lg border border-zinc-800 bg-zinc-900/60 space-y-1">
              <span className="text-zinc-500 text-[10px] block flex items-center gap-1">
                <Shield className="h-3 w-3 text-purple-400" /> EXECUTION URGENCY
              </span>
              <span className="text-xs font-bold text-white">
                {recommendation.urgency}
              </span>
            </div>
          </div>

          {/* Primary Action & Steps */}
          <div className="space-y-2">
            <div className="p-3 rounded-lg bg-zinc-900 border border-zinc-800">
              <span className="text-[10px] font-mono uppercase text-zinc-400 block">Recommended Corrective Action:</span>
              <p className="text-sm font-semibold text-white font-mono mt-0.5">{recommendation.action}</p>
            </div>

            {recommendation.repair_steps && recommendation.repair_steps.length > 0 && (
              <div className="space-y-2 font-mono">
                <span className="text-[11px] font-semibold text-zinc-300 block">
                  Step-by-Step Technician Execution Checklist:
                </span>
                <div className="space-y-1.5">
                  {recommendation.repair_steps.map((step, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 rounded bg-black/40 border border-zinc-900 flex items-start gap-2.5 text-xs"
                    >
                      <span className="h-5 w-5 rounded bg-zinc-800 text-zinc-300 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5 border border-zinc-700">
                        {idx + 1}
                      </span>
                      <span className="text-zinc-200">{step}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Tools & Parts Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono">
            <div className="p-3 rounded-lg border border-zinc-850 bg-zinc-900/40 space-y-1.5">
              <span className="text-zinc-400 text-[11px] font-semibold block">Required Diagnostic Tools & Instruments:</span>
              <div className="flex flex-wrap gap-1.5">
                {recommendation.required_tools.map((t, idx) => (
                  <span key={idx} className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700 text-[10px]">
                    {t}
                  </span>
                ))}
              </div>
            </div>

            <div className="p-3 rounded-lg border border-zinc-850 bg-zinc-900/40 space-y-1.5">
              <span className="text-zinc-400 text-[11px] font-semibold block">Expected Replacement Spares & Consumables:</span>
              <div className="flex flex-wrap gap-1.5">
                {recommendation.replacement_parts.map((p, idx) => (
                  <span key={idx} className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700 text-[10px]">
                    {p}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Row 3: Explainable Rationale for Campus Management */}
      {explanation && (
        <Card className="border-zinc-800 bg-zinc-950/80 print-card">
          <CardHeader className="pb-2 border-b border-zinc-900">
            <CardTitle className="text-sm font-semibold font-mono text-white flex items-center gap-2">
              <FileText className="h-4 w-4 text-zinc-300" />
              Executive Explanation & Justification Narrative
            </CardTitle>
            <CardDescription className="text-xs text-zinc-400">
              Audit-ready transparent breakdown for administration and finance
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-3 space-y-2 text-xs font-mono">
            <p className="text-zinc-300 leading-relaxed bg-black/40 p-3 rounded border border-zinc-900 whitespace-pre-line">
              {explanation.full_text}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Row 4: Multi-Agent Execution Trace & Audit Trail */}
      <Card className="border-zinc-800 bg-zinc-950/80 print-card">
        <CardHeader className="pb-2 border-b border-zinc-900">
          <CardTitle className="text-sm font-semibold font-mono text-white flex items-center gap-2">
            <Database className="h-4 w-4 text-emerald-400" />
            6-Agent Execution Trace & Guardrail Audit Log
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-3">
          <div className="space-y-2 text-xs font-mono">
            {agent_runs.map((r, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-2.5 rounded bg-zinc-900/50 border border-zinc-850"
              >
                <div className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  <span className="font-semibold text-white">{r.agent_name}</span>
                </div>
                <div className="flex items-center gap-3 text-zinc-400 text-[11px]">
                  <span className="truncate max-w-xs">{r.output_summary}</span>
                  <span className="text-zinc-500">{r.execution_time_ms}ms</span>
                  <span className="text-emerald-400 font-bold">{r.status}</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Row 5: Supporting Historical Cases (Clickable for full fix info) */}
      <Card className="border-zinc-800 bg-zinc-950/80 print-card">
        <CardHeader className="pb-2 border-b border-zinc-900 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-sm font-semibold font-mono text-white flex items-center gap-2">
              <Database className="h-4 w-4 text-zinc-300" />
              Retrieved Historical Case Precedents ({similar_cases.length} Matches)
            </CardTitle>
            <CardDescription className="text-xs text-zinc-400">
              Click any case card to view complete technical fix instructions and repair notes
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onExploreSimilar(raw_complaint, analysis.equipment_type)}
            className="text-xs font-mono border-zinc-800 bg-zinc-900 text-zinc-300 hover:text-white no-print"
          >
            Explore in Evidence Store <ArrowRight className="h-3 w-3 ml-1" />
          </Button>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-xs font-mono">
            {similar_cases.map((c) => (
              <div
                key={c.case_id}
                onClick={() => setSelectedCase(c)}
                className="p-3.5 rounded-lg border border-zinc-850 bg-zinc-900/40 hover:border-zinc-600 hover:bg-zinc-900 transition-all space-y-2 flex flex-col justify-between cursor-pointer group"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-white group-hover:text-emerald-400 transition-colors">
                      Case #{c.case_id}
                    </span>
                    <Badge
                      className={
                        c.similarity_percentage >= 80
                          ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                          : 'bg-zinc-800 text-zinc-300 border border-zinc-700'
                      }
                    >
                      {c.similarity_percentage}% Match
                    </Badge>
                  </div>

                  <div className="text-[11px] text-zinc-400 flex items-center justify-between">
                    <span>{c.equipment_type} ({c.equipment_id})</span>
                    <span className="truncate">{c.location}</span>
                  </div>

                  <p className="text-[11px] text-zinc-300 line-clamp-2 bg-black/40 p-1.5 rounded border border-zinc-900">
                    "{c.complaint}"
                  </p>

                  <div className="space-y-1 text-[11px] pt-1">
                    <div>
                      <span className="text-zinc-500">Diagnosis: </span>
                      <span className="text-zinc-200">{c.diagnosis}</span>
                    </div>
                    <div>
                      <span className="text-zinc-500">Fix: </span>
                      <span className="text-emerald-400">{c.recommended_fix}</span>
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-zinc-900 flex items-center justify-between text-[10px] text-zinc-500">
                  <span>₹{c.estimated_cost.toLocaleString('en-IN')}</span>
                  <span>{c.repair_time}h</span>
                  <span className="text-zinc-400 flex items-center gap-1 group-hover:text-white">
                    View Details <ExternalLink className="h-3 w-3" />
                  </span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Case Details Drawer / Modal */}
      {selectedCase && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-950 border border-zinc-800 rounded-xl max-w-2xl w-full p-6 space-y-4 text-xs font-mono shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div>
                <span className="text-[10px] uppercase text-zinc-500 block">Historical Reference Case</span>
                <h3 className="text-base font-bold text-white">
                  Case #{selectedCase.case_id} — {selectedCase.equipment_type} ({selectedCase.equipment_id})
                </h3>
              </div>
              <button
                onClick={() => setSelectedCase(null)}
                className="p-1.5 rounded-md hover:bg-zinc-900 text-zinc-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3 max-h-[65vh] overflow-y-auto pr-1">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-zinc-900/60 p-2.5 rounded border border-zinc-850 text-[11px]">
                <div>
                  <span className="text-zinc-500 block text-[10px]">SIMILARITY:</span>
                  <span className="text-emerald-400 font-bold">{selectedCase.similarity_percentage}%</span>
                </div>
                <div>
                  <span className="text-zinc-500 block text-[10px]">HISTORICAL COST:</span>
                  <span className="text-white font-bold">₹{selectedCase.estimated_cost.toLocaleString('en-IN')}</span>
                </div>
                <div>
                  <span className="text-zinc-500 block text-[10px]">REPAIR TIME:</span>
                  <span className="text-white font-bold">{selectedCase.repair_time} Hours</span>
                </div>
                <div>
                  <span className="text-zinc-500 block text-[10px]">DATE RESOLVED:</span>
                  <span className="text-zinc-300">{selectedCase.date}</span>
                </div>
              </div>

              <div className="p-3 rounded bg-black/40 border border-zinc-900 space-y-1">
                <span className="text-zinc-500 text-[10px] block">COMPLAINT & REPORTED SYMPTOMS:</span>
                <p className="text-zinc-200">"{selectedCase.complaint}"</p>
                {selectedCase.symptoms && <p className="text-zinc-400 text-[11px]">Symptoms: {selectedCase.symptoms}</p>}
              </div>

              <div className="p-3 rounded bg-zinc-900/60 border border-zinc-850 space-y-1">
                <span className="text-zinc-500 text-[10px] block">PROVEN ROOT CAUSE & DIAGNOSIS:</span>
                <p className="text-white font-semibold">{selectedCase.diagnosis}</p>
                <p className="text-zinc-400 text-[11px]">{selectedCase.root_cause}</p>
              </div>

              <div className="p-3 rounded bg-emerald-950/20 border border-emerald-900/40 space-y-1">
                <span className="text-emerald-400 text-[10px] block font-bold">RECOMMENDED PHYSICAL REPAIR:</span>
                <p className="text-emerald-200 font-semibold">{selectedCase.recommended_fix}</p>
              </div>

              {selectedCase.technician_notes && (
                <div className="p-3 rounded bg-black/40 border border-zinc-900 space-y-1">
                  <span className="text-zinc-500 text-[10px] block">LOGGED TECHNICIAN NOTES:</span>
                  <p className="text-zinc-300">{selectedCase.technician_notes}</p>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2 border-t border-zinc-800">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedCase(null)}
                className="text-xs font-mono border-zinc-700 bg-zinc-900 text-white"
              >
                Close Case Details
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Technician Review Modal */}
      <FeedbackModal
        complaintId={complaint_id}
        initialAccepted={initialFeedbackAccepted}
        isOpen={feedbackModalOpen}
        onClose={() => setFeedbackModalOpen(false)}
        onSuccess={handleFeedbackSuccess}
      />

      {/* Post-Approval Celebratory Next-Step Transition Modal */}
      {showPostApprovalModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-zinc-950 border border-emerald-700/80 rounded-2xl max-w-xl w-full p-6 sm:p-7 space-y-6 shadow-2xl relative font-sans text-left">
            <button
              onClick={() => setShowPostApprovalModal(false)}
              className="absolute top-4 right-4 text-zinc-400 hover:text-white p-1 rounded-md border border-zinc-800 bg-zinc-900"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-emerald-950/80 border border-emerald-700 text-emerald-400">
                <Sparkles className="h-7 w-7" />
              </div>
              <div>
                <span className="text-[10px] font-mono uppercase tracking-widest text-emerald-400 font-bold">
                  Decision Confirmed &amp; Dispatched
                </span>
                <h3 className="text-lg font-bold text-white font-mono">
                  {approvalType === 'technician'
                    ? 'Technician Verified & Appended to KB'
                    : 'Diagnosis Confirmed Accurate'}
                </h3>
                <p className="text-xs text-zinc-400 font-mono">
                  Complaint #{complaint_id} is now actively queued in the execution pipeline.
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-lg bg-zinc-900/60 border border-zinc-850 text-xs font-mono text-zinc-300">
              <p>Where would you like to navigate next in the facility management workflow?</p>
            </div>

            {/* Quick Transition Options Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 font-mono text-xs">
              <button
                onClick={() => {
                  setShowPostApprovalModal(false);
                  if (onNavigateTab) onNavigateTab('dashboard');
                }}
                className="p-3.5 rounded-xl border border-zinc-800 bg-zinc-900/80 hover:bg-zinc-850 hover:border-emerald-600/80 transition-all text-left group flex items-start gap-3"
              >
                <div className="p-2 rounded-lg bg-zinc-800 text-emerald-400 group-hover:scale-105 transition-transform">
                  <Rocket className="h-4 w-4" />
                </div>
                <div>
                  <div className="font-bold text-white group-hover:text-emerald-400 text-xs flex items-center gap-1">
                    <span>Command Center</span>
                    <ArrowRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <p className="text-[10px] text-zinc-400 mt-0.5">
                    Track live technician dispatch and campus SLA progress.
                  </p>
                </div>
              </button>

              <button
                onClick={() => {
                  setShowPostApprovalModal(false);
                  if (onNavigateTab) onNavigateTab('history');
                }}
                className="p-3.5 rounded-xl border border-zinc-800 bg-zinc-900/80 hover:bg-zinc-850 hover:border-emerald-600/80 transition-all text-left group flex items-start gap-3"
              >
                <div className="p-2 rounded-lg bg-zinc-800 text-zinc-300 group-hover:scale-105 transition-transform">
                  <BookOpen className="h-4 w-4" />
                </div>
                <div>
                  <div className="font-bold text-white group-hover:text-emerald-400 text-xs flex items-center gap-1">
                    <span>Knowledge Base</span>
                    <ArrowRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <p className="text-[10px] text-zinc-400 mt-0.5">
                    Inspect updated historical records and vector embeddings.
                  </p>
                </div>
              </button>

              <button
                onClick={() => {
                  setShowPostApprovalModal(false);
                  if (onNavigateTab) onNavigateTab('technicians');
                }}
                className="p-3.5 rounded-xl border border-zinc-800 bg-zinc-900/80 hover:bg-zinc-850 hover:border-emerald-600/80 transition-all text-left group flex items-start gap-3"
              >
                <div className="p-2 rounded-lg bg-zinc-800 text-amber-400 group-hover:scale-105 transition-transform">
                  <Users className="h-4 w-4" />
                </div>
                <div>
                  <div className="font-bold text-white group-hover:text-emerald-400 text-xs flex items-center gap-1">
                    <span>Workforce &amp; Finance</span>
                    <ArrowRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <p className="text-[10px] text-zinc-400 mt-0.5">
                    Settle technician labor hours and reconcile budget.
                  </p>
                </div>
              </button>

              <button
                onClick={() => {
                  setShowPostApprovalModal(false);
                  onNewComplaint();
                }}
                className="p-3.5 rounded-xl border border-zinc-800 bg-zinc-900/80 hover:bg-zinc-850 hover:border-emerald-600/80 transition-all text-left group flex items-start gap-3"
              >
                <div className="p-2 rounded-lg bg-zinc-800 text-purple-400 group-hover:scale-105 transition-transform">
                  <PlusCircle className="h-4 w-4" />
                </div>
                <div>
                  <div className="font-bold text-white group-hover:text-emerald-400 text-xs flex items-center gap-1">
                    <span>File New Issue</span>
                    <ArrowRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <p className="text-[10px] text-zinc-400 mt-0.5">
                    Submit another campus equipment diagnosis request.
                  </p>
                </div>
              </button>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-zinc-800 text-xs font-mono">
              <span className="text-[11px] text-zinc-500">Autonomous workflow ready</span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowPostApprovalModal(false)}
                className="border-zinc-800 text-zinc-400 hover:text-white"
              >
                Stay on this Report
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
