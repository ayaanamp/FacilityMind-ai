import React, { useState, useEffect } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Flame,
  HelpCircle,
  History,
  Phone,
  PlusCircle,
  RefreshCw,
  RotateCcw,
  Search,
  Send,
  Shield,
  Sparkles,
  Wrench,
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import {
  analyzeComplaint,
  fetchUserComplaints,
  reopenComplaint,
  trackComplaint,
} from '../services/api';
import { ComplaintTrackItem, OrganizationProfile } from '../types';

interface UserPortalViewProps {
  organization?: OrganizationProfile | null;
  initialTrackingCode?: string;
  onSelectAdminPortal?: () => void;
  initialSubTab?: 'submit' | 'track' | 'my-complaints' | 'guide';
  initialDraft?: {
    equipment_type?: string;
    location?: string;
    building?: string;
    floor?: string;
    room?: string;
    severity?: 'Low' | 'Medium' | 'High' | 'Critical';
    raw_complaint?: string;
  } | null;
}

export const UserPortalView: React.FC<UserPortalViewProps> = ({
  organization,
  initialTrackingCode,
  onSelectAdminPortal,
  initialSubTab,
  initialDraft,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'submit' | 'track' | 'my-complaints' | 'guide'>(initialSubTab || 'submit');

  // Form State
  const [rawComplaint, setRawComplaint] = useState('');
  const [equipmentType, setEquipmentType] = useState('Air Conditioner');
  const [location] = useState('Main Academic Block');
  const [building, setBuilding] = useState('');
  const [floor, setFloor] = useState('');
  const [room, setRoom] = useState('');
  const [severity, setSeverity] = useState<'Low' | 'Medium' | 'High' | 'Critical'>('Medium');
  const [reporterName, setReporterName] = useState(localStorage.getItem('fm_user_name') || '');
  const [reporterPhone, setReporterPhone] = useState(localStorage.getItem('fm_user_phone') || '');
  const [reporterDept] = useState('Computer Science');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState<any>(null);

  // Tracking State
  const [searchTrackingCode, setSearchTrackingCode] = useState(initialTrackingCode || '');
  const [trackedComplaint, setTrackedComplaint] = useState<ComplaintTrackItem | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [trackError, setTrackError] = useState<string | null>(null);

  // My Complaints List State
  const [myComplaints, setMyComplaints] = useState<ComplaintTrackItem[]>([]);
  const [isLoadingMyComplaints, setIsLoadingMyComplaints] = useState(false);

  // Reopen Modal State
  const [showReopenModal, setShowReopenModal] = useState(false);
  const [reopenReason, setReopenReason] = useState('');
  const [isReopening, setIsReopening] = useState(false);

  // Sync subtab if passed from parent
  useEffect(() => {
    if (initialSubTab) {
      setActiveSubTab(initialSubTab);
    }
  }, [initialSubTab]);

  // Sync draft complaint from AI bot if passed
  useEffect(() => {
    if (initialDraft) {
      if (initialDraft.raw_complaint) setRawComplaint(initialDraft.raw_complaint);
      if (initialDraft.equipment_type) setEquipmentType(initialDraft.equipment_type);
      if (initialDraft.building) setBuilding(initialDraft.building);
      if (initialDraft.floor) setFloor(initialDraft.floor);
      if (initialDraft.room) setRoom(initialDraft.room);
      if (initialDraft.severity) setSeverity(initialDraft.severity as any);
      setActiveSubTab('submit');
    }
  }, [initialDraft]);

  // Default Categories from Organization
  const categories = organization?.categories && organization.categories.length > 0
    ? organization.categories
    : [
        'Air Conditioner',
        'Diesel Generator',
        'Elevator',
        'Classroom Projector',
        'Water Pump',
        'RO Water Purifier',
        'Restroom / Washroom Plumbing',
        'Lighting & Electrical',
        'UPS System',
        'Network Switch / WiFi',
      ];

  // Auto-search if initialTrackingCode is provided
  useEffect(() => {
    if (initialTrackingCode) {
      setSearchTrackingCode(initialTrackingCode);
      setActiveSubTab('track');
      handleSearchTrack(initialTrackingCode);
    }
  }, [initialTrackingCode]);

  // Load user complaints if phone number is saved
  useEffect(() => {
    if (reporterPhone && reporterPhone.length >= 5) {
      loadMyComplaints(reporterPhone);
    }
  }, [reporterPhone]);

  const loadMyComplaints = async (phone: string) => {
    setIsLoadingMyComplaints(true);
    try {
      const data = await fetchUserComplaints(phone);
      setMyComplaints(data);
    } catch (err) {
      console.warn('Could not load user complaints:', err);
    } finally {
      setIsLoadingMyComplaints(false);
    }
  };

  const handleSubmitComplaint = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rawComplaint.trim() || rawComplaint.length < 5) {
      alert('Please enter at least 5 characters describing the issue.');
      return;
    }

    setIsSubmitting(true);
    setSubmitSuccess(null);

    // Save phone & name locally for convenience
    if (reporterName) localStorage.setItem('fm_user_name', reporterName);
    if (reporterPhone) localStorage.setItem('fm_user_phone', reporterPhone);

    const fullLocation = [building, floor ? `Floor ${floor}` : '', room ? `Room ${room}` : '', location]
      .filter(Boolean)
      .join(', ');

    try {
      const report = await analyzeComplaint({
        raw_complaint: rawComplaint,
        equipment_type: equipmentType,
        location: fullLocation || location,
        severity: severity,
        reporter_name: reporterName || 'Student / Campus Member',
        reporter_dept: reporterDept || 'General',
        reporter_phone: reporterPhone,
      });

      const trackingCode = `FM-${report.complaint_id.toString().padStart(4, '0')}`;
      setSubmitSuccess({
        complaint_id: report.complaint_id,
        tracking_code: trackingCode,
        primary_cause: report.diagnosis?.primary_cause || 'Under investigation',
        action: report.recommendation?.action || 'Inspection scheduled',
        severity: severity,
        location: fullLocation || location,
      });

      // Clear form
      setRawComplaint('');

      // Refresh my complaints list
      if (reporterPhone) {
        loadMyComplaints(reporterPhone);
      }
    } catch (err: any) {
      alert(err?.message || 'Error submitting complaint. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSearchTrack = async (codeToSearch?: string) => {
    const code = codeToSearch || searchTrackingCode;
    if (!code.trim()) return;

    setIsSearching(true);
    setTrackError(null);
    setTrackedComplaint(null);

    try {
      const data = await trackComplaint(code.trim());
      setTrackedComplaint(data);
    } catch (err: any) {
      setTrackError(err?.message || `No ticket found for tracking code "${code}".`);
    } finally {
      setIsSearching(false);
    }
  };

  const handleReopenTicket = async () => {
    if (!trackedComplaint || !reopenReason.trim()) return;
    setIsReopening(true);
    try {
      await reopenComplaint(trackedComplaint.id, {
        reason: reopenReason.trim(),
        actor_name: reporterName || trackedComplaint.reporter_name || 'Complainant',
      });
      setShowReopenModal(false);
      setReopenReason('');
      // Reload tracked complaint
      handleSearchTrack(trackedComplaint.tracking_code);
    } catch (err: any) {
      alert(err?.message || 'Failed to reopen complaint.');
    } finally {
      setIsReopening(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const s = status.toUpperCase();
    if (s === 'RESOLVED' || s === 'CLOSED') {
      return <Badge className="bg-emerald-950 text-emerald-300 border-emerald-700">RESOLVED</Badge>;
    }
    if (s === 'IN_PROGRESS' || s === 'ASSIGNED') {
      return <Badge className="bg-sky-950 text-sky-300 border-sky-700">IN PROGRESS</Badge>;
    }
    if (s === 'REOPENED') {
      return <Badge className="bg-amber-950 text-amber-300 border-amber-700">REOPENED</Badge>;
    }
    return <Badge className="bg-zinc-800 text-zinc-300 border-zinc-700">UNDER REVIEW</Badge>;
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Hero Welcome Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-zinc-950 via-zinc-900 to-zinc-950 border border-zinc-800 p-6 shadow-2xl">
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-950/80 border border-emerald-700 text-emerald-400 text-[11px] font-mono font-bold flex items-center gap-1.5">
                <Shield className="w-3 h-3" />
                STUDENT & RESIDENT PORTAL
              </span>
              <span className="text-zinc-500 text-xs">&bull;</span>
              <span className="text-zinc-400 text-xs font-sans">
                {organization?.name || 'Facility Operations Center'}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Campus Infrastructure Support
            </h1>
            <p className="text-xs sm:text-sm text-zinc-400 mt-1 max-w-2xl">
              Report equipment breakdowns, track real-time repair progress, and view verified resolution notes.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {onSelectAdminPortal && (
              <Button
                variant="outline"
                size="sm"
                onClick={onSelectAdminPortal}
                className="border-zinc-700 hover:border-emerald-500 hover:bg-zinc-900 text-zinc-300 hover:text-white text-xs flex items-center gap-1.5"
              >
                <Shield className="w-3.5 h-3.5 text-emerald-400" />
                <span>Admin Command Center</span>
              </Button>
            )}
          </div>
        </div>

        {/* Sub-Navigation Tabs */}
        <div className="flex items-center gap-2 mt-6 pt-4 border-t border-zinc-850 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveSubTab('submit')}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all shrink-0 ${
              activeSubTab === 'submit'
                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30'
                : 'bg-zinc-900 text-zinc-400 hover:text-white hover:bg-zinc-800 border border-zinc-800'
            }`}
          >
            <PlusCircle className="w-4 h-4" />
            <span>Submit Complaint</span>
          </button>

          <button
            onClick={() => setActiveSubTab('track')}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all shrink-0 ${
              activeSubTab === 'track'
                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30'
                : 'bg-zinc-900 text-zinc-400 hover:text-white hover:bg-zinc-800 border border-zinc-800'
            }`}
          >
            <Search className="w-4 h-4" />
            <span>Live Ticket Tracking</span>
          </button>

          <button
            onClick={() => {
              setActiveSubTab('my-complaints');
              if (reporterPhone) loadMyComplaints(reporterPhone);
            }}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all shrink-0 ${
              activeSubTab === 'my-complaints'
                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30'
                : 'bg-zinc-900 text-zinc-400 hover:text-white hover:bg-zinc-800 border border-zinc-800'
            }`}
          >
            <History className="w-4 h-4" />
            <span>My Complaints ({myComplaints.length})</span>
          </button>

          <button
            onClick={() => setActiveSubTab('guide')}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all shrink-0 ${
              activeSubTab === 'guide'
                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30'
                : 'bg-zinc-900 text-zinc-400 hover:text-white hover:bg-zinc-800 border border-zinc-800'
            }`}
          >
            <HelpCircle className="w-4 h-4" />
            <span>Facility FAQs & Guide</span>
          </button>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* TAB 1: SUBMIT COMPLAINT                                              */}
      {/* ==================================================================== */}
      {activeSubTab === 'submit' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card className="bg-zinc-950 border-zinc-850">
              <CardHeader className="pb-3 border-b border-zinc-850">
                <CardTitle className="text-base text-white flex items-center gap-2">
                  <Wrench className="w-4 h-4 text-emerald-400" />
                  Report Infrastructure Issue
                </CardTitle>
                <p className="text-xs text-zinc-400">
                  Fill in the details below. Our autonomous 6-agent AI immediately triages and assigns the correct technician.
                </p>
              </CardHeader>

              <CardContent className="pt-5">
                {submitSuccess ? (
                  <div className="p-5 rounded-2xl bg-emerald-950/40 border border-emerald-600/60 space-y-4 animate-in zoom-in-95">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-emerald-500/20 border border-emerald-500 flex items-center justify-center text-emerald-400">
                        <CheckCircle2 className="w-6 h-6" />
                      </div>
                      <div>
                        <h3 className="font-extrabold text-sm text-white">Complaint Submitted Successfully!</h3>
                        <p className="text-xs text-emerald-300">
                          Tracking Code: <span className="font-mono font-bold text-white text-sm bg-black px-2 py-0.5 rounded border border-emerald-800">{submitSuccess.tracking_code}</span>
                        </p>
                      </div>
                    </div>

                    <div className="bg-zinc-900/90 rounded-xl p-3 border border-zinc-800 space-y-2 text-xs">
                      <div className="flex justify-between">
                        <span className="text-zinc-400">AI Initial Diagnosis:</span>
                        <span className="text-zinc-200 font-semibold">{submitSuccess.primary_cause}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-400">Recommended Action:</span>
                        <span className="text-emerald-400 font-semibold">{submitSuccess.action}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-400">Location:</span>
                        <span className="text-zinc-300">{submitSuccess.location}</span>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 pt-2">
                      <Button
                        size="sm"
                        onClick={() => {
                          setSearchTrackingCode(submitSuccess.tracking_code);
                          setActiveSubTab('track');
                          handleSearchTrack(submitSuccess.tracking_code);
                        }}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold"
                      >
                        <Search className="w-3.5 h-3.5 mr-1" />
                        Track Ticket Progress
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setSubmitSuccess(null)}
                        className="border-zinc-700 text-zinc-300 hover:text-white text-xs"
                      >
                        File Another Complaint
                      </Button>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleSubmitComplaint} className="space-y-4">
                    {/* Complaint Description */}
                    <div>
                      <label className="block text-xs font-bold text-zinc-200 mb-1.5">
                        Describe the Fault / Problem <span className="text-red-400">*</span>
                      </label>
                      <textarea
                        rows={3}
                        value={rawComplaint}
                        onChange={(e) => setRawComplaint(e.target.value)}
                        placeholder="e.g. The AC in Computer Lab 3 is blowing warm air and making a loud rattling sound..."
                        required
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500 transition-colors leading-relaxed"
                      />
                    </div>

                    {/* Equipment Type & Severity */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-zinc-200 mb-1.5">
                          Equipment / Category
                        </label>
                        <select
                          value={equipmentType}
                          onChange={(e) => setEquipmentType(e.target.value)}
                          className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                        >
                          {categories.map((cat) => (
                            <option key={cat} value={cat}>
                              {cat}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-zinc-200 mb-1.5">
                          Urgency Level
                        </label>
                        <div className="grid grid-cols-4 gap-1.5">
                          {(['Low', 'Medium', 'High', 'Critical'] as const).map((lvl) => (
                            <button
                              type="button"
                              key={lvl}
                              onClick={() => setSeverity(lvl)}
                              className={`py-1.5 rounded-lg text-xs font-semibold transition-all ${
                                severity === lvl
                                  ? lvl === 'Critical'
                                    ? 'bg-red-600 text-white'
                                    : lvl === 'High'
                                    ? 'bg-amber-600 text-white'
                                    : lvl === 'Medium'
                                    ? 'bg-sky-600 text-white'
                                    : 'bg-emerald-600 text-white'
                                  : 'bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800'
                              }`}
                            >
                              {lvl}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Location Breakdown */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-zinc-300 mb-1">
                          Building / Block
                        </label>
                        <input
                          type="text"
                          list="block-suggestions"
                          value={building}
                          onChange={(e) => setBuilding(e.target.value)}
                          placeholder="e.g. Science Block A"
                          className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
                        />
                        {organization?.blocks && organization.blocks.length > 0 && (
                          <datalist id="block-suggestions">
                            {organization.blocks.map((b) => (
                              <option key={b} value={b} />
                            ))}
                          </datalist>
                        )}
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-zinc-300 mb-1">
                          Floor
                        </label>
                        <input
                          type="text"
                          value={floor}
                          onChange={(e) => setFloor(e.target.value)}
                          placeholder="e.g. 2nd Floor"
                          className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-zinc-300 mb-1">
                          Room / Lab / Area
                        </label>
                        <input
                          type="text"
                          value={room}
                          onChange={(e) => setRoom(e.target.value)}
                          placeholder="e.g. Lab 302"
                          className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                    </div>

                    {/* Reporter Info */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                      <div>
                        <label className="block text-xs font-medium text-zinc-300 mb-1">
                          Your Name
                        </label>
                        <input
                          type="text"
                          value={reporterName}
                          onChange={(e) => setReporterName(e.target.value)}
                          placeholder="e.g. Rahul Sharma"
                          className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-zinc-300 mb-1">
                          Phone Number (for SMS & Tracking)
                        </label>
                        <input
                          type="text"
                          value={reporterPhone}
                          onChange={(e) => setReporterPhone(e.target.value)}
                          placeholder="e.g. +91 98765 43210"
                          className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                    </div>

                    <div className="pt-2">
                      <Button
                        type="submit"
                        disabled={isSubmitting || !rawComplaint.trim()}
                        className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 rounded-xl shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2"
                      >
                        {isSubmitting ? (
                          <>
                            <Sparkles className="w-4 h-4 animate-spin text-white" />
                            <span>AI Ingestion & Triage in Progress...</span>
                          </>
                        ) : (
                          <>
                            <Send className="w-4 h-4" />
                            <span>Submit Complaint to Facility Operations</span>
                          </>
                        )}
                      </Button>
                    </div>
                  </form>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Info Column */}
          <div className="space-y-4">
            <Card className="bg-zinc-950 border-zinc-850">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                  What happens next?
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-xs text-zinc-400">
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-zinc-900 border border-zinc-750 flex items-center justify-center text-[10px] font-bold text-emerald-400 shrink-0 mt-0.5">
                    1
                  </span>
                  <p>
                    <strong className="text-zinc-200">Instant AI Diagnosis:</strong> Our 6-agent system matches your issue against 265+ verified repair precedents.
                  </p>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-zinc-900 border border-zinc-750 flex items-center justify-center text-[10px] font-bold text-emerald-400 shrink-0 mt-0.5">
                    2
                  </span>
                  <p>
                    <strong className="text-zinc-200">Specialist Assigned:</strong> The on-duty certified technician (HVAC, Electrical, Plumbing, AV) is dispatched.
                  </p>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-zinc-900 border border-zinc-750 flex items-center justify-center text-[10px] font-bold text-emerald-400 shrink-0 mt-0.5">
                    3
                  </span>
                  <p>
                    <strong className="text-zinc-200">Live Timeline Updates:</strong> Check back here with your tracking ID (e.g. <span className="font-mono text-emerald-400">FM-0001</span>) for live progress.
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-zinc-950 border-zinc-850">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-emerald-400" />
                  Facility Help Desk
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-zinc-400 space-y-2">
                <p>
                  <strong>Operating Hours:</strong> {organization?.operating_hours || '24/7 Campus Coverage'}
                </p>
                <p>
                  <strong>Emergency Helpline:</strong> +91 (080) 4122-3900
                </p>
                <p>
                  <strong>Admin Contact:</strong> {organization?.admin_name || 'Campus Facility Manager'}
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 2: LIVE TICKET TRACKING                                          */}
      {/* ==================================================================== */}
      {activeSubTab === 'track' && (
        <div className="space-y-6">
          <Card className="bg-zinc-950 border-zinc-850">
            <CardContent className="pt-6">
              <div className="max-w-xl mx-auto space-y-3">
                <h3 className="text-sm font-bold text-white text-center">
                  Enter Tracking Code or Ticket ID
                </h3>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-3" />
                    <input
                      type="text"
                      value={searchTrackingCode}
                      onChange={(e) => setSearchTrackingCode(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSearchTrack()}
                      placeholder="e.g. FM-0001 or 1"
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-9 pr-3 py-2.5 text-xs text-white placeholder-zinc-500 font-mono font-bold focus:outline-none focus:border-emerald-500 uppercase"
                    />
                  </div>
                  <Button
                    onClick={() => handleSearchTrack()}
                    disabled={isSearching || !searchTrackingCode.trim()}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-lg shadow-emerald-600/30"
                  >
                    {isSearching ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Track Live'}
                  </Button>
                </div>
                <p className="text-[11px] text-zinc-500 text-center">
                  Format: <span className="font-mono text-zinc-400">FM-0001</span> or enter your registered phone number in the 'My Complaints' tab.
                </p>
              </div>
            </CardContent>
          </Card>

          {trackError && (
            <div className="p-4 rounded-xl bg-red-950/40 border border-red-800/80 text-red-300 text-xs text-center flex items-center justify-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{trackError}</span>
            </div>
          )}

          {trackedComplaint && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in duration-200">
              {/* Left 2 Cols: Ticket Overview & Public Resolution Notes */}
              <div className="lg:col-span-2 space-y-6">
                <Card className="bg-zinc-950 border-zinc-850">
                  <CardHeader className="pb-3 border-b border-zinc-850 flex flex-row items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-base text-white">
                          {trackedComplaint.tracking_code}
                        </span>
                        {getStatusBadge(trackedComplaint.status)}
                      </div>
                      <p className="text-xs text-zinc-400 mt-1">
                        Reported on {trackedComplaint.created_at || 'Recently'}
                      </p>
                    </div>

                    {(trackedComplaint.status === 'RESOLVED' || trackedComplaint.status === 'CLOSED') && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowReopenModal(true)}
                        className="border-amber-800 text-amber-400 hover:bg-amber-950 text-xs flex items-center gap-1.5"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Problem Persists? Reopen</span>
                      </Button>
                    )}
                  </CardHeader>

                  <CardContent className="pt-4 space-y-4 text-xs">
                    <div>
                      <span className="text-zinc-500 uppercase font-mono text-[10px] tracking-wider block mb-1">
                        Raw Complaint Text
                      </span>
                      <p className="text-zinc-200 bg-zinc-900/90 p-3 rounded-xl border border-zinc-800 font-sans leading-relaxed">
                        {trackedComplaint.raw_complaint}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-zinc-900/50 p-3 rounded-xl border border-zinc-850">
                      <div>
                        <span className="text-zinc-500 text-[10px] block">Equipment</span>
                        <span className="text-zinc-200 font-semibold">{trackedComplaint.equipment_type || 'General'}</span>
                      </div>
                      <div>
                        <span className="text-zinc-500 text-[10px] block">Location</span>
                        <span className="text-zinc-200 font-semibold">{trackedComplaint.location || 'Campus'}</span>
                      </div>
                      <div>
                        <span className="text-zinc-500 text-[10px] block">Urgency</span>
                        <span className="text-zinc-200 font-semibold">{trackedComplaint.severity}</span>
                      </div>
                      <div>
                        <span className="text-zinc-500 text-[10px] block">Assigned Specialist</span>
                        <span className="text-emerald-400 font-semibold">
                          {trackedComplaint.assigned_technician_name || 'Operations Team'}
                        </span>
                      </div>
                    </div>

                    {/* Public Resolution Notes if resolved */}
                    {trackedComplaint.public_resolution_notes && (
                      <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-700/60 space-y-2">
                        <div className="flex items-center gap-2 text-emerald-300 font-bold text-xs">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          Official Resolution Notes
                        </div>
                        <p className="text-zinc-200 leading-relaxed font-sans">
                          {trackedComplaint.public_resolution_notes}
                        </p>
                        {trackedComplaint.resolved_at && (
                          <p className="text-[10px] text-emerald-400/80 font-mono">
                            Resolved at: {trackedComplaint.resolved_at}
                          </p>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Right Col: Step-by-Step Chronological Timeline */}
              <div>
                <Card className="bg-zinc-950 border-zinc-850 h-full">
                  <CardHeader className="pb-3 border-b border-zinc-850">
                    <CardTitle className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-emerald-400" />
                      Live Lifecycle Timeline
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-4">
                    <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-zinc-800">
                      {trackedComplaint.timeline_events && trackedComplaint.timeline_events.length > 0 ? (
                        trackedComplaint.timeline_events.map((evt, idx) => (
                          <div key={evt.id || idx} className="relative">
                            {/* Dot */}
                            <span
                              className={`absolute -left-6 top-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                                evt.event_type === 'RESOLVED'
                                  ? 'bg-emerald-500 border-emerald-300 shadow-sm shadow-emerald-500'
                                  : evt.event_type === 'REOPENED'
                                  ? 'bg-amber-500 border-amber-300'
                                  : 'bg-zinc-900 border-emerald-500'
                              }`}
                            >
                              <span className="w-1.5 h-1.5 rounded-full bg-white" />
                            </span>

                            <div>
                              <div className="flex items-center justify-between gap-1">
                                <span className="font-bold text-xs text-white">
                                  {evt.event_type.replace('_', ' ')}
                                </span>
                                <span className="text-[10px] text-zinc-500 font-mono">
                                  {evt.created_at ? evt.created_at.slice(11, 16) : ''}
                                </span>
                              </div>
                              <p className="text-xs text-zinc-300 mt-0.5 leading-relaxed">
                                {evt.message}
                              </p>
                              <p className="text-[10px] text-zinc-500 mt-1 font-mono">
                                By {evt.actor_name} ({evt.actor_role})
                              </p>
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="text-xs text-zinc-500">Timeline events will appear as work progresses.</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {/* Reopen Modal */}
          {showReopenModal && trackedComplaint && (
            <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-2xl p-5 space-y-4 shadow-2xl animate-in zoom-in-95">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-sm text-white flex items-center gap-2">
                    <RotateCcw className="w-4 h-4 text-amber-400" />
                    Reopen Complaint #{trackedComplaint.tracking_code}
                  </h3>
                  <button
                    onClick={() => setShowReopenModal(false)}
                    className="text-zinc-400 hover:text-white text-xs"
                  >
                    Cancel
                  </button>
                </div>

                <p className="text-xs text-zinc-400">
                  If the problem was not fully solved or recurred after technician resolution, explain what is still happening.
                </p>

                <textarea
                  rows={3}
                  value={reopenReason}
                  onChange={(e) => setReopenReason(e.target.value)}
                  placeholder="e.g. The AC started rattling again after 2 hours..."
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-amber-500 leading-relaxed"
                />

                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowReopenModal(false)}
                    className="border-zinc-800 text-zinc-400 text-xs"
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleReopenTicket}
                    disabled={isReopening || !reopenReason.trim()}
                    className="bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs"
                  >
                    {isReopening ? 'Submitting...' : 'Confirm Reopen Ticket'}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 3: MY COMPLAINTS LIST                                            */}
      {/* ==================================================================== */}
      {activeSubTab === 'my-complaints' && (
        <div className="space-y-6">
          <Card className="bg-zinc-950 border-zinc-850">
            <CardHeader className="pb-3 border-b border-zinc-850 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base text-white flex items-center gap-2">
                  <History className="w-4 h-4 text-emerald-400" />
                  My Submitted Complaints
                </CardTitle>
                <p className="text-xs text-zinc-400">
                  Showing complaints associated with your phone number.
                </p>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <input
                  type="text"
                  value={reporterPhone}
                  onChange={(e) => setReporterPhone(e.target.value)}
                  placeholder="Enter phone number..."
                  className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-emerald-500 w-44"
                />
                <Button
                  size="sm"
                  onClick={() => loadMyComplaints(reporterPhone)}
                  disabled={isLoadingMyComplaints || !reporterPhone}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold px-3 py-1.5 rounded-xl"
                >
                  {isLoadingMyComplaints ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : 'Search'}
                </Button>
              </div>
            </CardHeader>

            <CardContent className="pt-4">
              {myComplaints.length === 0 ? (
                <div className="py-12 text-center text-zinc-500 space-y-2">
                  <History className="w-8 h-8 text-zinc-700 mx-auto" />
                  <p className="text-xs">No complaints found for this phone number.</p>
                  <Button
                    size="sm"
                    onClick={() => setActiveSubTab('submit')}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs mt-2"
                  >
                    Submit a New Complaint
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {myComplaints.map((item) => (
                    <div
                      key={item.id}
                      className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800/80 hover:border-zinc-700 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-xs text-white bg-black px-2 py-0.5 rounded border border-zinc-800">
                            {item.tracking_code}
                          </span>
                          {getStatusBadge(item.status)}
                          <span className="text-zinc-500 text-xs font-mono">{item.created_at || 'Recently'}</span>
                        </div>
                        <p className="text-xs text-zinc-200 line-clamp-1 max-w-xl font-sans">
                          {item.raw_complaint}
                        </p>
                        <div className="flex items-center gap-3 text-[11px] text-zinc-400">
                          <span>📍 {item.location || 'Campus'}</span>
                          <span>🔧 {item.equipment_type || 'Equipment'}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <Button
                          size="sm"
                          onClick={() => {
                            setSearchTrackingCode(item.tracking_code);
                            setActiveSubTab('track');
                            handleSearchTrack(item.tracking_code);
                          }}
                          className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold px-3 py-1.5 rounded-xl shadow-md"
                        >
                          <Search className="w-3.5 h-3.5 mr-1" />
                          Track Timeline
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 4: FACILITY GUIDE & FAQS                                         */}
      {/* ==================================================================== */}
      {activeSubTab === 'guide' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="bg-zinc-950 border-zinc-850">
            <CardHeader className="pb-3 border-b border-zinc-850">
              <CardTitle className="text-sm font-bold text-white flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-emerald-400" />
                Frequently Asked Questions
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-4 text-xs text-zinc-300">
              <div>
                <h4 className="font-bold text-white mb-1">How fast does a technician respond?</h4>
                <p className="text-zinc-400 leading-relaxed">
                  Critical issues (power failure, elevator stop, water flood) are dispatched within 15 minutes. Standard AC and lighting repairs are attended to within 2 to 4 business hours.
                </p>
              </div>
              <div>
                <h4 className="font-bold text-white mb-1">What if the issue happens after hours?</h4>
                <p className="text-zinc-400 leading-relaxed">
                  Our emergency duty technicians operate 24/7. Emergency tickets submitted at night are routed directly to the duty warden and on-call engineering team.
                </p>
              </div>
              <div>
                <h4 className="font-bold text-white mb-1">Can I reopen a ticket if the issue isn't solved?</h4>
                <p className="text-zinc-400 leading-relaxed">
                  Yes! In the <strong>Live Ticket Tracking</strong> tab, open your ticket and click <strong>'Problem Persists? Reopen'</strong>. The supervisor will be notified immediately.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-zinc-950 border-zinc-850">
            <CardHeader className="pb-3 border-b border-zinc-850">
              <CardTitle className="text-sm font-bold text-white flex items-center gap-2">
                <Shield className="w-4 h-4 text-emerald-400" />
                Campus Safety & Care Guidelines
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-4 text-xs text-zinc-300">
              <div className="p-3 rounded-xl bg-red-950/30 border border-red-800/60 text-red-200">
                <h4 className="font-bold mb-1 flex items-center gap-1.5">
                  <Flame className="w-3.5 h-3.5 text-red-400" />
                  Electrical & Fire Hazards
                </h4>
                <p className="text-[11px] text-red-300 leading-relaxed">
                  If you see sparks, smoke, or smell burning wires, DO NOT touch the switch. Immediately trip the local MCB if safe, report as <strong>Critical</strong> severity, and call emergency extension 100.
                </p>
              </div>

              <div>
                <h4 className="font-bold text-white mb-1">Projector & AV Care</h4>
                <p className="text-zinc-400 leading-relaxed">
                  Always use the remote control to power down projectors rather than turning off the wall switch directly. This allows the internal cooling fan to run and prevents lamp blowout.
                </p>
              </div>

              <div>
                <h4 className="font-bold text-white mb-1">Water Conservation</h4>
                <p className="text-zinc-400 leading-relaxed">
                  Report leaking flush valves or taps immediately. A single leaking cistern can waste up to 200 liters of water daily.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};
