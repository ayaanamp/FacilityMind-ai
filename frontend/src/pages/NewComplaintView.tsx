import React, { useState } from 'react';
import {
  AlertTriangle,
  Clock,
  Cpu,
  Loader2,
  Phone,
  Send,
  Terminal,
  User,
  Zap,
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/Card';
import { AgentWorkflowProgress } from '../components/AgentWorkflowProgress';
import { analyzeComplaint, fetchOrganizationSettings } from '../services/api';
import { DecisionReport } from '../types';

interface NewComplaintViewProps {
  onDecisionGenerated: (decision: DecisionReport) => void;
  initialValues?: {
    complaint?: string;
    equipment?: string;
    location?: string;
    severity?: string;
    reporterName?: string;
    reporterDept?: string;
  };
}

interface DemoScenario {
  id: string;
  title: string;
  equipment: string;
  location: string;
  severity: 'Low' | 'Medium' | 'High' | 'Critical';
  reporterName: string;
  reporterDept: string;
  noticedAt: string;
  complaint: string;
}

const DEMO_SCENARIOS: DemoScenario[] = [
  {
    id: 's1',
    title: 'AC Failure & Noise',
    equipment: 'Air Conditioner',
    location: 'Computer Lab 3 (CSE Block)',
    severity: 'Medium',
    reporterName: 'Prof. Rajesh Kumar',
    reporterDept: 'Department of Computer Science',
    noticedAt: 'Today, 09:30 AM',
    complaint: 'The AC in Computer Lab 3 is not cooling properly and is making a loud rattling noise.',
  },
  {
    id: 's2',
    title: 'Generator Crank Failure',
    equipment: 'Diesel Generator',
    location: 'Main Power Yard / Substation',
    severity: 'Critical',
    reporterName: 'Er. Amit Verma',
    reporterDept: 'Campus Electrical Maintenance',
    noticedAt: 'Today, 11:15 AM',
    complaint: 'Diesel Generator fails to crank or start during main grid power outage. Clicking starter solenoid sound.',
  },
  {
    id: 's3',
    title: 'Elevator Door Cycle Loop',
    equipment: 'Elevator',
    location: 'Academic Block A - Core',
    severity: 'High',
    reporterName: 'Dr. Sunita Rao',
    reporterDept: 'Dean Academics Office',
    noticedAt: 'Today, 08:45 AM',
    complaint: 'Elevator doors repeatedly closing and reopening without passenger obstruction on Floor 2 buzzer sounding.',
  },
  {
    id: 's4',
    title: 'Projector Thermal Shutdown',
    equipment: 'Classroom Projector',
    location: 'Lecture Hall 204',
    severity: 'Medium',
    reporterName: 'Dr. Vikram Sen',
    reporterDept: 'School of Mechanical Engineering',
    noticedAt: 'Today, 01:45 PM',
    complaint: 'Projector turning on for 2 minutes then shutting down with blinking red Temp light and loud exhaust fan whining.',
  },
  {
    id: 's5',
    title: 'Water Pump Priming Lost',
    equipment: 'Water Pump',
    location: 'Main Overhead Tank Sub-station',
    severity: 'High',
    reporterName: 'S. Narayanan',
    reporterDept: 'Hostel & Sanitation Operations',
    noticedAt: 'Today, 06:15 AM',
    complaint: 'Water pump running continuously but delivering very low water pressure to top floors with zero gauge reading.',
  },
  {
    id: 's6',
    title: 'Washroom Flush & Leakage',
    equipment: 'Restroom / Washroom Plumbing',
    location: '1st Floor Science Block Restrooms',
    severity: 'High',
    reporterName: 'Kavita Menon',
    reporterDept: 'Facility Health & Sanitation',
    noticedAt: 'Today, 08:30 AM',
    complaint: 'Water continuously leaking from flush valve into commode tank with low water pressure in wash basin tap.',
  },
  {
    id: 's7',
    title: 'Hallway Light Flickering',
    equipment: 'Lighting & Electrical',
    location: 'Main Academic Quad Corridor 3',
    severity: 'Low',
    reporterName: 'Kiran Patel',
    reporterDept: 'Campus Safety & Infrastructure',
    noticedAt: 'Today, 07:45 AM',
    complaint: 'Fluorescent LED tube light fixture flickering violently and making a humming sound in the corridor.',
  },
];

export const NewComplaintView: React.FC<NewComplaintViewProps> = ({
  onDecisionGenerated,
  initialValues,
}) => {
  const [complaintText, setComplaintText] = useState('');
  const [equipmentType, setEquipmentType] = useState('');
  const [customHardwareName, setCustomHardwareName] = useState('');
  const [customHardwareTag, setCustomHardwareTag] = useState('');
  const [location, setLocation] = useState('');
  const [severity, setSeverity] = useState<string>('Medium');
  const [reporterName, setReporterName] = useState('');
  const [reporterDept, setReporterDept] = useState('');
  const [reporterPhone, setReporterPhone] = useState('');
  const [noticedAt, setNoticedAt] = useState('');

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const [categories, setCategories] = useState<string[]>([
    'Air Conditioner',
    'Diesel Generator',
    'Elevator',
    'Water Pump',
    'Restroom / Washroom Plumbing',
    'Lighting & Electrical',
    'Classroom Projector',
    'Laboratory Equipment',
    'Physics & Electronics Apparatus',
    'UPS System',
    'RO Water Purifier',
    'Electrical Panel',
    'CCTV Camera',
    'Network Switch',
  ]);

  React.useEffect(() => {
    fetchOrganizationSettings()
      .then((org) => {
        if (org.categories && org.categories.length > 0) {
          setCategories(org.categories);
        }
      })
      .catch(() => {});
  }, []);

  React.useEffect(() => {
    if (initialValues) {
      if (initialValues.complaint) setComplaintText(initialValues.complaint);
      if (initialValues.equipment) setEquipmentType(initialValues.equipment);
      if (initialValues.location) setLocation(initialValues.location);
      if (initialValues.severity) setSeverity(initialValues.severity);
      if (initialValues.reporterName) setReporterName(initialValues.reporterName);
      if (initialValues.reporterDept) setReporterDept(initialValues.reporterDept);
    }
  }, [initialValues]);

  const isCustomHardware = equipmentType === 'Custom Hardware / Other';

  const validatePhoneNumber = (phone: string): boolean => {
    const cleaned = phone.replace(/[\s\-()]/g, '');
    // Support +91XXXXXXXXXX, 91XXXXXXXXXX, 10-digit standard mobile number
    return /^(\+?\d{1,3})?[6-9]\d{9}$/.test(cleaned) || /^\+?\d{10,14}$/.test(cleaned);
  };

  const handleClearForm = () => {
    setComplaintText('');
    setEquipmentType('');
    setLocation('');
    setSeverity('Medium');
    setReporterName('');
    setReporterDept('');
    setReporterPhone('');
    setNoticedAt('');
    setCustomHardwareName('');
    setCustomHardwareTag('');
    setFormErrors({});
    setError(null);
  };

  const handleSelectScenario = (sc: DemoScenario) => {
    setComplaintText(sc.complaint);
    setEquipmentType(sc.equipment);
    setLocation(sc.location);
    setSeverity(sc.severity);
    setReporterName(sc.reporterName);
    setReporterDept(sc.reporterDept);
    setReporterPhone('+91 98765 43210');
    setNoticedAt(sc.noticedAt);
    setCustomHardwareName('');
    setCustomHardwareTag('');
    setFormErrors({});
    setError(null);
  };

  const handleAnalyze = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isAnalyzing) return;

    // Strict validation
    const errors: Record<string, string> = {};
    if (!reporterName.trim() || reporterName.trim().length < 2) {
      errors.reporterName = 'Reporter Full Name is required (minimum 2 characters).';
    }
    if (!reporterPhone.trim()) {
      errors.reporterPhone = 'Contact phone number is required.';
    } else if (!validatePhoneNumber(reporterPhone)) {
      errors.reporterPhone = 'Enter a valid 10-digit mobile number (e.g. +91 98765 43210).';
    }
    if (!reporterDept.trim()) {
      errors.reporterDept = 'Class / Department / Role is required.';
    }
    if (!noticedAt.trim()) {
      errors.noticedAt = 'When observed time is required (e.g. Today, 10:15 AM).';
    }
    if (!equipmentType.trim()) {
      errors.equipmentType = 'Please select an Equipment Category from the dropdown.';
    } else if (isCustomHardware && !customHardwareName.trim()) {
      errors.customHardware = 'Custom Hardware / Equipment Name is required.';
    }
    if (!location.trim() || location.trim().length < 2) {
      errors.location = 'Facility / Room Location is required (e.g. Computer Lab 3).';
    }
    if (!complaintText.trim() || complaintText.trim().length < 10) {
      errors.complaintText = 'Please provide a detailed complaint description (minimum 10 characters).';
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      setError('Please resolve the highlighted validation errors before dispatching agents.');
      return;
    }

    setFormErrors({});
    setIsAnalyzing(true);
    setError(null);
    setActiveStep(0);

    const resolvedEquipment = isCustomHardware && customHardwareName.trim()
      ? customHardwareName.trim()
      : equipmentType;

    const resolvedEquipmentId = isCustomHardware && customHardwareTag.trim()
      ? customHardwareTag.trim()
      : undefined;

    // Simulate animated step progression while LangGraph executes
    const stepInterval = setInterval(() => {
      setActiveStep((prev) => (prev < 5 ? prev + 1 : prev));
    }, 450);

    try {
      const decision = await analyzeComplaint({
        raw_complaint: complaintText.trim(),
        equipment_type: resolvedEquipment || undefined,
        equipment_id: resolvedEquipmentId,
        location: location.trim() || undefined,
        severity: severity,
        reporter_name: reporterName.trim() || undefined,
        reporter_dept: reporterDept.trim() || undefined,
        noticed_at: noticedAt.trim() || undefined,
        reporter_phone: reporterPhone.trim() || undefined,
      });

      clearInterval(stepInterval);
      setActiveStep(6);
      setTimeout(() => {
        setIsAnalyzing(false);
        onDecisionGenerated(decision);
      }, 300);
    } catch (err: unknown) {
      clearInterval(stepInterval);
      setIsAnalyzing(false);
      setError(err instanceof Error ? err.message : 'Multi-agent analysis failed');
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-in fade-in duration-300 pb-16">
      {/* Header */}
      <div className="border-b border-zinc-800 pb-4">
        <div className="flex items-center gap-2 text-zinc-400 text-xs font-mono uppercase tracking-wider mb-1">
          <Terminal className="h-4 w-4 text-white" />
          <span>Autonomous Multi-Agent Intake Engine</span>
        </div>
        <h2 className="text-xl font-bold tracking-tight text-white font-mono">
          Intake & Multi-Agent Diagnosis Dispatch
        </h2>
        <p className="text-xs text-zinc-400 mt-0.5 font-mono">
          Submit an unstructured facility maintenance complaint to trigger the 6-agent evidence reasoning pipeline.
        </p>
      </div>

      {/* Demo Scenario Quick-Pick Buttons */}
      <div className="space-y-2">
        <label className="text-xs font-medium font-mono text-zinc-300 flex items-center gap-1.5">
          <Zap className="h-3.5 w-3.5 text-emerald-400 fill-current" />
          Quick Load Hackathon Demo Scenarios:
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
          {DEMO_SCENARIOS.map((sc) => {
            const isSelected = complaintText === sc.complaint;
            return (
              <button
                key={sc.id}
                type="button"
                onClick={() => handleSelectScenario(sc)}
                className={`p-2.5 rounded-lg border text-left transition-all flex flex-col justify-between text-xs font-mono ${
                  isSelected
                    ? 'border-white bg-zinc-900 text-white ring-1 ring-white/30 shadow-md'
                    : 'border-zinc-850 bg-zinc-950/80 text-zinc-400 hover:text-white hover:bg-zinc-900 hover:border-zinc-700'
                }`}
              >
                <div>
                  <span className="font-semibold block text-[11px] text-zinc-200">{sc.title}</span>
                  <span className="text-[10px] text-zinc-500 line-clamp-1">{sc.location}</span>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700">
                    {sc.equipment}
                  </span>
                  <span className={`text-[9px] font-semibold ${sc.severity === 'Critical' ? 'text-red-400' : 'text-amber-400'}`}>
                    {sc.severity}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Intake Form */}
      <Card className="border-zinc-800 bg-zinc-950/90 shadow-xl">
        <CardHeader className="pb-3 border-b border-zinc-900">
          <CardTitle className="text-sm font-semibold font-mono text-white flex items-center gap-2">
            <Cpu className="h-4 w-4 text-white" />
            Maintenance Incident & Reporter Parameters
          </CardTitle>
          <CardDescription className="text-xs text-zinc-400 font-mono">
            Enter full details; our Complaint Analysis Agent will normalize, triage, and trigger evidence retrieval.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          <form onSubmit={handleAnalyze} className="space-y-4 text-xs font-mono">
            {error && (
              <div className="p-3 rounded-md bg-zinc-950 border border-red-900/60 text-red-400 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Row 1: Reporter Info (Name, Phone, Class/Department, When Noticed) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-zinc-900/40 p-3 rounded-lg border border-zinc-850">
              <div className="space-y-1">
                <label className="font-semibold text-zinc-300 flex items-center gap-1.5">
                  <User className="h-3 w-3 text-zinc-400" />
                  Reporter Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={reporterName}
                  onChange={(e) => {
                    setReporterName(e.target.value);
                    if (formErrors.reporterName) {
                      setFormErrors((prev) => ({ ...prev, reporterName: '' }));
                    }
                  }}
                  placeholder="e.g. Prof. Rajesh Kumar / Kabir M."
                  className={`w-full rounded-md border bg-black/60 px-3 py-2 text-white focus:outline-none text-xs ${
                    formErrors.reporterName ? 'border-red-500 focus:border-red-400' : 'border-zinc-800 focus:border-white'
                  }`}
                />
                {formErrors.reporterName && (
                  <span className="text-[10px] text-red-400 block">{formErrors.reporterName}</span>
                )}
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-zinc-300 flex items-center gap-1.5">
                  <Phone className="h-3 w-3 text-emerald-400" />
                  Contact Phone Number *
                </label>
                <input
                  type="text"
                  required
                  value={reporterPhone}
                  onChange={(e) => {
                    setReporterPhone(e.target.value);
                    if (formErrors.reporterPhone) {
                      setFormErrors((prev) => ({ ...prev, reporterPhone: '' }));
                    }
                  }}
                  placeholder="e.g. +91 98765 43210"
                  className={`w-full rounded-md border bg-black/60 px-3 py-2 text-white focus:outline-none text-xs font-mono ${
                    formErrors.reporterPhone ? 'border-red-500 focus:border-red-400' : 'border-zinc-800 focus:border-white'
                  }`}
                />
                {formErrors.reporterPhone && (
                  <span className="text-[10px] text-red-400 block">{formErrors.reporterPhone}</span>
                )}
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-zinc-300">
                  Class / Department / Role *
                </label>
                <input
                  type="text"
                  required
                  value={reporterDept}
                  onChange={(e) => {
                    setReporterDept(e.target.value);
                    if (formErrors.reporterDept) {
                      setFormErrors((prev) => ({ ...prev, reporterDept: '' }));
                    }
                  }}
                  placeholder="e.g. CSE Dept / 3rd Year B.Tech"
                  className={`w-full rounded-md border bg-black/60 px-3 py-2 text-white focus:outline-none text-xs ${
                    formErrors.reporterDept ? 'border-red-500 focus:border-red-400' : 'border-zinc-800 focus:border-white'
                  }`}
                />
                {formErrors.reporterDept && (
                  <span className="text-[10px] text-red-400 block">{formErrors.reporterDept}</span>
                )}
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-zinc-300 flex items-center gap-1.5">
                  <Clock className="h-3 w-3 text-zinc-400" />
                  When Observed *
                </label>
                <input
                  type="text"
                  required
                  value={noticedAt}
                  onChange={(e) => {
                    setNoticedAt(e.target.value);
                    if (formErrors.noticedAt) {
                      setFormErrors((prev) => ({ ...prev, noticedAt: '' }));
                    }
                  }}
                  placeholder="e.g. Today, 10:15 AM"
                  className={`w-full rounded-md border bg-black/60 px-3 py-2 text-white focus:outline-none text-xs ${
                    formErrors.noticedAt ? 'border-red-500 focus:border-red-400' : 'border-zinc-800 focus:border-white'
                  }`}
                />
                {formErrors.noticedAt && (
                  <span className="text-[10px] text-red-400 block">{formErrors.noticedAt}</span>
                )}
              </div>
            </div>

            {/* Row 2: Equipment Category, Facility Location, Initial Urgency */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="font-semibold text-zinc-300">Equipment Category *</label>
                <select
                  value={equipmentType}
                  onChange={(e) => {
                    setEquipmentType(e.target.value);
                    if (formErrors.equipmentType) {
                      setFormErrors((prev) => ({ ...prev, equipmentType: '' }));
                    }
                  }}
                  className={`w-full rounded-md border bg-black/60 px-3 py-2 text-white focus:outline-none text-xs ${
                    formErrors.equipmentType ? 'border-red-500 focus:border-red-400' : 'border-zinc-800 focus:border-white'
                  }`}
                >
                  <option value="" disabled>-- Select Equipment Category * --</option>
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                  <option value="Custom Hardware / Other">+ Add Custom Hardware / Other Asset...</option>
                </select>
                {formErrors.equipmentType && (
                  <span className="text-[10px] text-red-400 block">{formErrors.equipmentType}</span>
                )}
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-zinc-300">Facility / Room Location *</label>
                <input
                  type="text"
                  required
                  value={location}
                  onChange={(e) => {
                    setLocation(e.target.value);
                    if (formErrors.location) {
                      setFormErrors((prev) => ({ ...prev, location: '' }));
                    }
                  }}
                  placeholder="e.g. Computer Lab 3 (CSE Block)"
                  className={`w-full rounded-md border bg-black/60 px-3 py-2 text-white focus:outline-none text-xs ${
                    formErrors.location ? 'border-red-500 focus:border-red-400' : 'border-zinc-800 focus:border-white'
                  }`}
                />
                {formErrors.location && (
                  <span className="text-[10px] text-red-400 block">{formErrors.location}</span>
                )}
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-zinc-300">Initial Urgency Indicator</label>
                <select
                  value={severity}
                  onChange={(e) => setSeverity(e.target.value)}
                  className="w-full rounded-md border border-zinc-800 bg-black/60 px-3 py-2 text-white focus:outline-none focus:border-white text-xs"
                >
                  <option value="Low">Low (Routine Servicing)</option>
                  <option value="Medium">Medium (Attention Required)</option>
                  <option value="High">High (Disruptive / Lab Down)</option>
                  <option value="Critical">Critical (Emergency / Safety Hazard)</option>
                </select>
              </div>
            </div>

            {/* Conditional Row: Extra Custom Hardware Specifications */}
            {isCustomHardware && (
              <div className="space-y-2 p-3 bg-zinc-900/60 rounded-lg border border-zinc-700 animate-in fade-in duration-200">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="font-semibold text-emerald-400">Custom Hardware / Equipment Name *</label>
                    <input
                      type="text"
                      required
                      value={customHardwareName}
                      onChange={(e) => {
                        setCustomHardwareName(e.target.value);
                        if (formErrors.customHardware) {
                          setFormErrors((prev) => ({ ...prev, customHardware: '' }));
                        }
                      }}
                      placeholder="e.g. Chemistry Test Tube Set / Smart Interactive Board / 3D Printer"
                      className={`w-full rounded-md border bg-black px-3 py-2 text-white focus:outline-none text-xs ${
                        formErrors.customHardware ? 'border-red-500 focus:border-red-400' : 'border-zinc-700 focus:border-emerald-400'
                      }`}
                    />
                    {formErrors.customHardware && (
                      <span className="text-[10px] text-red-400 block">{formErrors.customHardware}</span>
                    )}
                  </div>
                  <div className="space-y-1">
                    <label className="font-semibold text-emerald-400">Hardware Serial / Asset Tag (Optional)</label>
                    <input
                      type="text"
                      value={customHardwareTag}
                      onChange={(e) => setCustomHardwareTag(e.target.value)}
                      placeholder="e.g. CHEM-GLASS-02 / SIB-042"
                      className="w-full rounded-md border border-zinc-700 bg-black px-3 py-2 text-white focus:outline-none focus:border-emerald-400 text-xs"
                    />
                  </div>
                </div>

                {/* Quick Suggestion Pills */}
                <div className="pt-1 flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] text-zinc-500">Quick Templates:</span>
                  {[
                    { label: 'Chemistry Lab Glassware', name: 'Chemistry Lab Test Tubes & Glassware', tag: 'CHEM-LAB-01' },
                    { label: 'Fume Hood Exhaust', name: 'Chemical Fume Hood Exhaust Fan', tag: 'FH-012' },
                    { label: 'Restroom Flush Valve', name: 'Restroom Flush Valve & Sensor', tag: 'PLUMB-FLUSH-04' },
                    { label: 'Smart Interactive Board', name: 'Smart Interactive Touch Display', tag: 'SIB-101' },
                    { label: '3D Printer', name: 'Additive Manufacturing 3D Printer', tag: '3DP-02' },
                  ].map((tmpl) => (
                    <button
                      key={tmpl.label}
                      type="button"
                      onClick={() => {
                        setCustomHardwareName(tmpl.name);
                        setCustomHardwareTag(tmpl.tag);
                        if (formErrors.customHardware) {
                          setFormErrors((prev) => ({ ...prev, customHardware: '' }));
                        }
                      }}
                      className="px-2 py-0.5 rounded text-[10px] font-mono bg-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-700 border border-zinc-700 transition-colors"
                    >
                      + {tmpl.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Raw Complaint Textarea */}
            <div className="space-y-1">
              <label className="font-semibold text-zinc-300 flex items-center justify-between">
                <span>Raw Maintenance Complaint Description *</span>
                <span className="text-[10px] text-zinc-500 font-normal">Unstructured natural language supported</span>
              </label>
              <textarea
                rows={4}
                required
                value={complaintText}
                onChange={(e) => {
                  setComplaintText(e.target.value);
                  if (formErrors.complaintText) {
                    setFormErrors((prev) => ({ ...prev, complaintText: '' }));
                  }
                }}
                placeholder="Describe what is failing, unusual noises, error codes, leaking fluid, temperature issues, etc..."
                className={`w-full rounded-md border bg-black/60 p-3 text-white focus:outline-none text-xs leading-relaxed ${
                  formErrors.complaintText ? 'border-red-500 focus:border-red-400' : 'border-zinc-800 focus:border-white'
                }`}
              />
              {formErrors.complaintText && (
                <span className="text-[10px] text-red-400 block">{formErrors.complaintText}</span>
              )}
            </div>

            {/* Submit Action Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-zinc-900">
              <div className="text-[11px] text-zinc-500">
                <span>Pipeline dispatches: Analyzer → Retrieval → Diagnosis → Recommendation → Explanation → Validator</span>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleClearForm}
                  disabled={isAnalyzing}
                  className="border-zinc-800 bg-zinc-950 hover:bg-zinc-900 text-zinc-400 text-xs active:scale-[0.98]"
                >
                  Clear Form
                </Button>

                <Button
                  type="submit"
                  disabled={isAnalyzing || !complaintText.trim()}
                  className="bg-white hover:bg-zinc-200 text-black font-semibold text-xs flex items-center gap-2 px-5 py-2 shadow-sm"
                >
                  {isAnalyzing ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin text-black" />
                      <span>Dispatching Multi-Agent Network...</span>
                    </>
                  ) : (
                    <>
                      <Send className="h-3.5 w-3.5" />
                      <span>ANALYZE WITH FACILITYMIND</span>
                    </>
                  )}
                </Button>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Live Agent Execution Stepper Card */}
      {isAnalyzing && (
        <Card className="border-white/40 bg-zinc-950 p-4 shadow-2xl animate-in fade-in duration-200">
          <AgentWorkflowProgress isRunning={isAnalyzing} activeAgentIndex={activeStep} />
        </Card>
      )}
    </div>
  );
};
