import { Suspense, lazy, useEffect, useState } from 'react';
import { Navbar, TabType } from './components/Navbar';
import { GeminiChatBot } from './components/GeminiChatBot';
import { fetchDecisionReport, fetchHealth } from './services/api';
import { DecisionReport, SimilarCase } from './types';
import { Loader2 } from 'lucide-react';

const DashboardView = lazy(() =>
  import('./pages/DashboardView').then((m) => ({ default: m.DashboardView }))
);
const NewComplaintView = lazy(() =>
  import('./pages/NewComplaintView').then((m) => ({ default: m.NewComplaintView }))
);
const DecisionReportView = lazy(() =>
  import('./pages/DecisionReportView').then((m) => ({ default: m.DecisionReportView }))
);
const SimilarCasesView = lazy(() =>
  import('./pages/SimilarCasesView').then((m) => ({ default: m.SimilarCasesView }))
);
const MaintenanceHistoryView = lazy(() =>
  import('./pages/MaintenanceHistoryView').then((m) => ({ default: m.MaintenanceHistoryView }))
);
const TechniciansView = lazy(() =>
  import('./pages/TechniciansView').then((m) => ({ default: m.TechniciansView }))
);
const SystemHealthView = lazy(() =>
  import('./pages/SystemHealthView').then((m) => ({ default: m.SystemHealthView }))
);

function ViewLoadingSkeleton() {
  return (
    <div className="min-h-[50vh] flex flex-col items-center justify-center space-y-3">
      <Loader2 className="w-7 h-7 text-emerald-400 animate-spin" />
      <p className="text-xs font-mono text-zinc-400">Loading module chunk...</p>
    </div>
  );
}

export function App() {
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [currentDecision, setCurrentDecision] = useState<DecisionReport | null>(null);
  const [similarQuery, setSimilarQuery] = useState('AC not cooling and making loud rattling noise');
  const [similarEquipment, setSimilarEquipment] = useState('Air Conditioner');
  const [isBackendHealthy, setIsBackendHealthy] = useState(true);
  const [complaintInitialValues, setComplaintInitialValues] = useState<{
    complaint?: string;
    equipment?: string;
    location?: string;
    severity?: string;
    reporterName?: string;
    reporterDept?: string;
  } | undefined>(undefined);


  useEffect(() => {
    fetchHealth()
      .then((h) => setIsBackendHealthy(h.status === 'ok'))
      .catch(() => setIsBackendHealthy(false));
  }, []);

  const handleDecisionGenerated = (decision: DecisionReport) => {
    setCurrentDecision(decision);
    setActiveTab('decision');
  };

  const handleExploreSimilar = (query: string, equipment?: string) => {
    setSimilarQuery(query);
    if (equipment) setSimilarEquipment(equipment);
    setActiveTab('similar-cases');
  };

  const handleInspectComplaint = async (complaintId: number) => {
    try {
      const report = await fetchDecisionReport(complaintId);
      setCurrentDecision(report);
      setActiveTab('decision');
    } catch (err) {
      console.warn('Could not fetch stored report for complaint', complaintId, err);
      setActiveTab('decision');
    }
  };

  const handleSelectCaseForComplaint = (caseItem: SimilarCase) => {
    setComplaintInitialValues({
      complaint: caseItem.complaint,
      equipment: caseItem.equipment_type,
      location: caseItem.location,
      severity: caseItem.urgency as 'Low' | 'Medium' | 'High' | 'Critical',
      reporterName: 'Facility Tech Team',
      reporterDept: 'Infrastructure Operations',
    });
    setActiveTab('new-complaint');
  };

  const handleDraftFromChat = (draft: {
    equipment_type: string;
    location: string;
    severity: string;
    raw_complaint: string;
  }) => {
    setComplaintInitialValues({
      complaint: draft.raw_complaint,
      equipment: draft.equipment_type,
      location: draft.location,
      severity: (draft.severity as 'Low' | 'Medium' | 'High' | 'Critical') || 'Medium',
      reporterName: 'Campus AI Assistant User',
      reporterDept: 'Facility Operations',
    });
    setActiveTab('new-complaint');
  };

  const handleDeleteComplaintReport = (_deletedId: number) => {
    setCurrentDecision(null);
    setActiveTab('dashboard');
  };

  const handleQuickDemo = async () => {
    setActiveTab('new-complaint');
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col justify-between selection:bg-zinc-800 selection:text-white font-sans antialiased">
      {/* Top Fixed Command Center Header */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onQuickDemo={handleQuickDemo}
      />

      {/* Main Content Area with Code-Splitting Suspense */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6">
        <Suspense fallback={<ViewLoadingSkeleton />}>
          {activeTab === 'dashboard' && (
            <DashboardView
              onNewComplaint={() => setActiveTab('new-complaint')}
              onExploreEvidence={(category?: string, location?: string) => {
                if (category) setSimilarEquipment(category);
                if (location) setSimilarQuery(`Issues at ${location}`);
                setActiveTab('similar-cases');
              }}
              onInspectComplaint={handleInspectComplaint}
              onQuickDemoScenario={handleQuickDemo}
              onSelectSearchForComplaint={(query, equipment, location) => {
                setComplaintInitialValues({
                  complaint: query,
                  equipment,
                  location,
                  severity: 'High',
                  reporterName: 'Prof. Rajesh Kumar',
                  reporterDept: 'Department of Computer Science',
                });
                setActiveTab('new-complaint');
              }}
            />
          )}

          {activeTab === 'new-complaint' && (
            <NewComplaintView
              onDecisionGenerated={handleDecisionGenerated}
              initialValues={complaintInitialValues}
            />
          )}

          {activeTab === 'decision' && (
            <DecisionReportView
              decision={currentDecision}
              onNewComplaint={() => setActiveTab('new-complaint')}
              onExploreSimilar={handleExploreSimilar}
              onDeleteComplaint={handleDeleteComplaintReport}
              onNavigateTab={(tab) => setActiveTab(tab as TabType)}
            />
          )}

          {activeTab === 'similar-cases' && (
            <SimilarCasesView
              initialQuery={similarQuery}
              initialEquipment={similarEquipment}
              onSelectForComplaint={handleSelectCaseForComplaint}
            />
          )}

          {activeTab === 'history' && (
            <MaintenanceHistoryView
              onInspectComplaint={handleInspectComplaint}
              onLoadComplaintToAnalyze={(complaint, equipment) => {
                setComplaintInitialValues({
                  complaint,
                  equipment,
                  severity: 'Medium',
                  reporterName: 'Prof. Rajesh Kumar',
                  reporterDept: 'Department of Computer Science',
                });
                setActiveTab('new-complaint');
              }}
            />
          )}

          {activeTab === 'technicians' && <TechniciansView />}

          {activeTab === 'health' && <SystemHealthView />}
        </Suspense>
      </main>


      {/* Floating Gemini AI Copilot */}
      <GeminiChatBot
        onDraftComplaint={handleDraftFromChat}
        onNavigateTab={(tab) => setActiveTab(tab as TabType)}
        activeComplaintId={currentDecision?.complaint_id}
      />


      {/* Enterprise Status Footer with Interactive Diagnostics Pill */}
      <footer className="border-t border-zinc-850 bg-zinc-950/95 backdrop-blur-md py-3 px-4 sm:px-8 text-xs font-mono text-zinc-400">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
          <div className="flex items-center gap-3">
            <div
              onClick={() => setActiveTab('health')}
              className="cursor-pointer flex items-center gap-2 px-2.5 py-1 rounded-md border border-zinc-800 bg-zinc-900 hover:bg-zinc-800 hover:border-emerald-700/60 transition-all text-zinc-300"
              title="Click to view Diagnostic Telemetry"
            >
              <span className={`h-2 w-2 rounded-full ${isBackendHealthy ? 'bg-emerald-400 animate-pulse shadow-sm shadow-emerald-400' : 'bg-red-500'}`} />
              <span className="text-[11px] font-bold text-emerald-400 tracking-wide">
                {isBackendHealthy ? 'AI SYSTEM ONLINE' : 'SYSTEM DEGRADED'}
              </span>
            </div>
            <span className="hidden md:inline text-zinc-700">|</span>
            <span className="hidden md:inline text-[11px] text-zinc-400">
              ⚡ 6-Agent LangGraph Pipeline Active &bull; Sub-50ms RAG Vector Retrieval
            </span>
          </div>
          <div className="flex items-center gap-4 text-[11px] text-zinc-500">
            <span>FacilityMind AI v0.2 Enterprise</span>
            <span>&bull;</span>
            <span className="text-zinc-400">Continuous Closed-Loop Learning</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;

