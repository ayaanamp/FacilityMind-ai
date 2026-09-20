import { Suspense, lazy, useEffect, useState, useRef } from 'react';
import { Navbar, TabType, PortalMode } from './components/Navbar';
import { GeminiChatBot } from './components/GeminiChatBot';
import { UserChatBot } from './components/UserChatBot';
import { NotificationsDrawer } from './components/NotificationsDrawer';
import { OnboardingModal } from './components/OnboardingModal';
import { AdminLoginModal } from './components/AdminLoginModal';
import { AdminPasswordModal } from './components/AdminPasswordModal';
import { OrganizationSettingsModal } from './components/OrganizationSettingsModal';
import { EquipmentInventoryModal } from './components/EquipmentInventoryModal';
import {
  fetchCurrentAdmin,
  fetchDecisionReport,
  fetchHealth,
  fetchNotifications,
  fetchOrganizationStatus,
  logoutAdmin,
} from './services/api';
import { AdminUser, DecisionReport, NotificationItem, OrganizationProfile, SimilarCase } from './types';
import { Loader2, Sparkles, X } from 'lucide-react';

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
const UserPortalView = lazy(() =>
  import('./pages/UserPortalView').then((m) => ({ default: m.UserPortalView }))
);

function ViewLoadingSkeleton() {
  return (
    <div className="min-h-[50vh] flex flex-col items-center justify-center space-y-3">
      <Loader2 className="w-7 h-7 text-emerald-400 animate-spin" />
      <p className="text-xs font-mono text-zinc-400">Loading module chunk...</p>
    </div>
  );
}

interface ToastMessage {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning';
}

export function App() {
  // Navigation & Portal State
  const [portalMode, setPortalMode] = useState<PortalMode>('user');
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [userPortalTrackingCode, setUserPortalTrackingCode] = useState<string | undefined>(undefined);
  const [userPortalSubTab, setUserPortalSubTab] = useState<'submit' | 'track' | 'my-complaints' | 'guide'>('submit');
  const [userPortalDraft, setUserPortalDraft] = useState<any>(null);

  // Admin Authentication State
  const [adminUser, setAdminUser] = useState<AdminUser | null>(() => {
    try {
      const saved = localStorage.getItem('fm_admin_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [showAdminLoginModal, setShowAdminLoginModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);

  // Decision & Complaint State
  const [currentDecision, setCurrentDecision] = useState<DecisionReport | null>(null);
  const [similarQuery, setSimilarQuery] = useState('AC not cooling and making loud rattling noise');
  const [similarEquipment, setSimilarEquipment] = useState('Air Conditioner');
  const [isBackendHealthy, setIsBackendHealthy] = useState(true);

  // Organization & Workspace State
  const [organization, setOrganization] = useState<OrganizationProfile | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showEquipmentModal, setShowEquipmentModal] = useState(false);
  const [showNotificationsDrawer, setShowNotificationsDrawer] = useState(false);

  // Live Notifications & WebSocket State
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isWsConnected, setIsWsConnected] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const wsRef = useRef<WebSocket | null>(null);

  const [complaintInitialValues, setComplaintInitialValues] = useState<{
    complaint?: string;
    equipment?: string;
    location?: string;
    severity?: string;
    reporterName?: string;
    reporterDept?: string;
  } | undefined>(undefined);

  const addToast = (title: string, message: string, type: 'info' | 'success' | 'warning' = 'info') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, title, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 6000);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const checkOrgStatus = async () => {
    try {
      const status = await fetchOrganizationStatus();
      if (status.organization) {
        setOrganization(status.organization);
      }
      if (!status.setup_completed) {
        setShowOnboarding(true);
      }
    } catch (err) {
      console.warn('Could not check organization status:', err);
    }
  };

  const loadNotifications = async () => {
    try {
      const notifs = await fetchNotifications();
      setNotifications(notifs);
    } catch (err) {
      console.warn('Could not fetch notifications:', err);
    }
  };

  // Setup WebSocket connection with auto-reconnect
  useEffect(() => {
    const apiHost = window.location.hostname || 'localhost';
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${wsProtocol}//${apiHost}:8000/api/v1/ws/events`;

    let reconnectTimer: any = null;

    const connectWs = () => {
      try {
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          setIsWsConnected(true);
          console.log('[FacilityMind Real-time] WebSocket connected to', wsUrl);
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'complaint.created') {
              addToast(
                `New Complaint #${data.data.tracking_code || data.data.complaint_id}`,
                `${data.data.equipment_type} issue reported at ${data.data.location}`,
                'info'
              );
              loadNotifications();
            } else if (data.type === 'complaint.resolved') {
              addToast(
                `Complaint #${data.data.tracking_code || data.data.complaint_id} Resolved`,
                `Work finished: ${data.data.resolution_notes}`,
                'success'
              );
              loadNotifications();
            } else if (data.type === 'complaint.reopened') {
              addToast(
                `Complaint #${data.data.tracking_code || data.data.complaint_id} Reopened`,
                `Reason: ${data.data.reason}`,
                'warning'
              );
              loadNotifications();
            }
          } catch (e) {
            console.warn('WebSocket message parse error:', e);
          }
        };

        ws.onclose = () => {
          setIsWsConnected(false);
          reconnectTimer = setTimeout(connectWs, 4000);
        };

        ws.onerror = () => {
          setIsWsConnected(false);
          ws.close();
        };
      } catch (err) {
        setIsWsConnected(false);
        reconnectTimer = setTimeout(connectWs, 4000);
      }
    };

    connectWs();
    loadNotifications();

    return () => {
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  useEffect(() => {
    fetchHealth()
      .then((h) => setIsBackendHealthy(h.status === 'ok'))
      .catch(() => setIsBackendHealthy(false));

    checkOrgStatus();

    const token = localStorage.getItem('fm_admin_token');
    if (token) {
      fetchCurrentAdmin()
        .then((user) => setAdminUser(user))
        .catch(() => {
          localStorage.removeItem('fm_admin_token');
          localStorage.removeItem('fm_admin_user');
          setAdminUser(null);
        });
    }
  }, []);

  const handlePortalModeChange = (mode: PortalMode) => {
    if (mode === 'admin') {
      if (organization && !organization.setup_completed) {
        setShowOnboarding(true);
        return;
      }
      const token = localStorage.getItem('fm_admin_token');
      if (!adminUser && !token) {
        setShowAdminLoginModal(true);
        return;
      }
    }
    setPortalMode(mode);
  };

  const handleAdminLoginSuccess = (user: AdminUser) => {
    setAdminUser(user);
    setPortalMode('admin');
    setShowAdminLoginModal(false);
    addToast('Authenticated', `Welcome back, ${user.full_name || user.username}`, 'success');
  };

  const handleLogoutAdmin = async () => {
    await logoutAdmin();
    setAdminUser(null);
    setPortalMode('user');
    addToast('Signed Out', 'You have been logged out of the Admin Portal.', 'info');
  };

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
      reporterName: organization?.admin_name || 'Facility Tech Team',
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
      reporterName: organization?.admin_name || 'Facility Operations Staff',
      reporterDept: 'Facility Operations',
    });
    setActiveTab('new-complaint');
  };

  const handleDeleteComplaintReport = (_deletedId: number) => {
    setCurrentDecision(null);
    setActiveTab('dashboard');
  };

  const handleQuickDemo = async () => {
    handlePortalModeChange('admin');
    setActiveTab('new-complaint');
  };

  const handleOnboardingComplete = (org: OrganizationProfile) => {
    setOrganization(org);
    setShowOnboarding(false);
    try {
      const savedUser = localStorage.getItem('fm_admin_user');
      if (savedUser) setAdminUser(JSON.parse(savedUser));
    } catch {}
    setPortalMode('admin');
    setActiveTab('dashboard');
  };

  const unreadNotificationsCount = notifications.filter((n) => !n.is_read).length;

  return (
    <div className="min-h-screen bg-black text-white flex flex-col justify-between selection:bg-zinc-800 selection:text-white font-sans antialiased">
      {/* Top Fixed Command Center Header */}
      <Navbar
        portalMode={portalMode}
        setPortalMode={handlePortalModeChange}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onQuickDemo={handleQuickDemo}
        organization={organization}
        adminUser={adminUser}
        onLogoutAdmin={handleLogoutAdmin}
        onOpenSettings={() => setShowSettingsModal(true)}
        onOpenPasswordModal={() => setShowPasswordModal(true)}
        onOpenEquipment={() => setShowEquipmentModal(true)}
        onOpenNotifications={() => setShowNotificationsDrawer(true)}
        unreadNotificationsCount={unreadNotificationsCount}
        isWsConnected={isWsConnected}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6">
        <Suspense fallback={<ViewLoadingSkeleton />}>
          {portalMode === 'user' ? (
            <UserPortalView
              organization={organization}
              initialTrackingCode={userPortalTrackingCode}
              initialSubTab={userPortalSubTab}
              initialDraft={userPortalDraft}
              onSelectAdminPortal={() => handlePortalModeChange('admin')}
            />
          ) : (
            <>
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
                      reporterName: organization?.admin_name || 'Campus Member',
                      reporterDept: 'Facility User',
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
                      reporterName: organization?.admin_name || 'Staff Member',
                      reporterDept: 'Facility Operations',
                    });
                    setActiveTab('new-complaint');
                  }}
                />
              )}

              {activeTab === 'technicians' && <TechniciansView />}

              {activeTab === 'health' && <SystemHealthView />}
            </>
          )}
        </Suspense>
      </main>

      {/* Floating AI Copilot (Context-Aware based on active portal) */}
      {portalMode === 'user' ? (
        <UserChatBot
          userPhone={localStorage.getItem('fm_user_phone') || ''}
          onNavigateTab={(tab) => {
            if (['submit', 'track', 'my-complaints', 'guide'].includes(tab)) {
              setUserPortalSubTab(tab as any);
            }
          }}
          onTrackTicket={(code) => {
            setUserPortalTrackingCode(code);
            setUserPortalSubTab('track');
          }}
          onDraftComplaint={(draft) => {
            setUserPortalDraft(draft);
            setUserPortalSubTab('submit');
          }}
        />
      ) : (
        <GeminiChatBot
          onDraftComplaint={handleDraftFromChat}
          onNavigateTab={(tab) => setActiveTab(tab as TabType)}
          activeComplaintId={currentDecision?.complaint_id}
        />
      )}

      {/* Live Notifications Drawer */}
      <NotificationsDrawer
        isOpen={showNotificationsDrawer}
        onClose={() => setShowNotificationsDrawer(false)}
        notifications={notifications}
        onRefresh={loadNotifications}
        onSelectComplaint={(cid) => {
          if (portalMode === 'admin') {
            handleInspectComplaint(cid);
          } else {
            setUserPortalTrackingCode(`FM-${cid.toString().padStart(4, '0')}`);
          }
        }}
        userPhone={localStorage.getItem('fm_user_phone') || undefined}
      />

      {/* First-Run Onboarding Modal */}
      <OnboardingModal
        isOpen={showOnboarding}
        onComplete={handleOnboardingComplete}
      />

      {/* Admin Authentication Login Modal */}
      <AdminLoginModal
        isOpen={showAdminLoginModal}
        onClose={() => setShowAdminLoginModal(false)}
        onSuccess={handleAdminLoginSuccess}
        orgName={organization?.name}
      />

      {/* Admin Credentials & Password Management Modal */}
      <AdminPasswordModal
        isOpen={showPasswordModal}
        onClose={() => setShowPasswordModal(false)}
        adminUser={adminUser}
        onAdminUpdated={(user) => {
          setAdminUser(user);
          addToast('Credentials Updated', `Admin profile and password updated for ${user.full_name || user.username}.`, 'success');
        }}
        onRequireRelogin={() => {
          handleLogoutAdmin();
          setShowAdminLoginModal(true);
        }}
      />

      {/* Organization Settings Modal */}
      <OrganizationSettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        onOrganizationUpdated={(org) => setOrganization(org)}
        onOpenEquipmentInventory={() => setShowEquipmentModal(true)}
      />

      {/* Equipment Inventory Modal */}
      <EquipmentInventoryModal
        isOpen={showEquipmentModal}
        onClose={() => setShowEquipmentModal(false)}
        categories={
          organization?.categories || [
            'Air Conditioner',
            'Diesel Generator',
            'Elevator',
            'Water Pump',
            'Lighting & Electrical',
            'Classroom Projector',
            'UPS System',
            'RO Water Purifier',
            'Electrical Panel',
            'CCTV Camera',
            'Network Switch',
          ]
        }
      />

      {/* Real-time Toast Notifications */}
      <div className="fixed top-20 right-4 z-50 space-y-2 max-w-sm pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`p-3.5 rounded-2xl border shadow-2xl pointer-events-auto flex items-start gap-3 backdrop-blur-xl animate-in slide-in-from-top-4 duration-300 ${
              toast.type === 'success'
                ? 'bg-emerald-950/90 border-emerald-500/60 text-white'
                : toast.type === 'warning'
                ? 'bg-amber-950/90 border-amber-500/60 text-white'
                : 'bg-zinc-900/90 border-zinc-750 text-white'
            }`}
          >
            <div className="p-1.5 rounded-lg bg-black/40 text-emerald-400 shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <div className="flex-1 text-xs">
              <h4 className="font-bold text-zinc-100">{toast.title}</h4>
              <p className="text-zinc-300 mt-0.5 leading-relaxed">{toast.message}</p>
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              className="text-zinc-400 hover:text-white p-1 rounded transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>

      {/* Enterprise Status Footer */}
      <footer className="border-t border-zinc-850 bg-zinc-950/95 backdrop-blur-md py-3 px-4 sm:px-8 text-xs font-mono text-zinc-400">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
          <div className="flex items-center gap-3">
            <div
              onClick={() => {
                if (portalMode === 'admin') setActiveTab('health');
              }}
              className="cursor-pointer flex items-center gap-2 px-2.5 py-1 rounded-md border border-zinc-800 bg-zinc-900 hover:bg-zinc-800 hover:border-emerald-700/60 transition-all text-zinc-300"
              title="Click to view Diagnostic Telemetry"
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  isBackendHealthy ? 'bg-emerald-400 animate-pulse shadow-sm shadow-emerald-400' : 'bg-red-500'
                }`}
              />
              <span className="text-[11px] font-bold text-emerald-400 tracking-wide">
                {isBackendHealthy ? 'AI SYSTEM ONLINE' : 'SYSTEM DEGRADED'}
              </span>
            </div>
            <span className="hidden md:inline text-zinc-700">|</span>
            <span className="hidden md:inline text-[11px] text-zinc-400">
              ⚡ 6-Agent LangGraph Pipeline Active &bull; Real-time WebSocket Bus &bull; Scoped Gemini AI
            </span>
          </div>
          <div className="flex items-center gap-4 text-[11px] text-zinc-500">
            <span>FacilityMind AI &bull; {organization?.name || 'Enterprise Facility Intelligence'}</span>
            <span>&bull;</span>
            <span className="text-zinc-400">Continuous Closed-Loop Learning</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
