import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Building,
  CheckCircle2,
  Database,
  Key,
  Layers,
  Loader2,
  Plus,
  Save,
  Sparkles,
  Trash2,
  User,
  X,
  Zap,
} from 'lucide-react';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import {
  fetchOrganizationSettings,
  loadDemoWorkspace,
  resetWorkspaceData,
  updateOrganizationSettings,
  verifyGeminiApiKey,
} from '../services/api';
import { OrganizationProfile } from '../types';

interface OrganizationSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOrganizationUpdated: (org: OrganizationProfile) => void;
  onOpenEquipmentInventory?: () => void;
}

export const OrganizationSettingsModal: React.FC<OrganizationSettingsModalProps> = ({
  isOpen,
  onClose,
  onOrganizationUpdated,
  onOpenEquipmentInventory,
}) => {
  const [activeTab, setActiveTab] = useState<'profile' | 'admin' | 'categories' | 'ai' | 'data'>('profile');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Profile fields
  const [org, setOrg] = useState<OrganizationProfile | null>(null);
  const [name, setName] = useState('');
  const [orgType, setOrgType] = useState('College');
  const [primaryLocation, setPrimaryLocation] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [country, setCountry] = useState('India');
  const [buildingsCount, setBuildingsCount] = useState(1);
  const [floorsCount, setFloorsCount] = useState(1);
  const [approxUsersCount, setApproxUsersCount] = useState(0);
  const [operatingHours, setOperatingHours] = useState('24/7 Operations');

  // Admin fields
  const [adminName, setAdminName] = useState('');
  const [adminUsername, setAdminUsername] = useState('admin');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminRole, setAdminRole] = useState('');
  const [adminPhone, setAdminPhone] = useState('');

  // Categories
  const [categories, setCategories] = useState<string[]>([]);
  const [newCatInput, setNewCatInput] = useState('');

  // Gemini API Key
  const [geminiKey, setGeminiKey] = useState('');
  const [verifyingKey, setVerifyingKey] = useState(false);
  const [keyVerifyResult, setKeyVerifyResult] = useState<{ valid: boolean; message: string } | null>(null);

  // Reset confirmation modal state
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetConfirmInput, setResetConfirmInput] = useState('');
  const [isResetting, setIsResetting] = useState(false);
  const [isLoadingDemo, setIsLoadingDemo] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    setMessage(null);
    fetchOrganizationSettings()
      .then((data) => {
        setOrg(data);
        setName(data.name || '');
        setOrgType(data.org_type || 'College');
        setPrimaryLocation(data.primary_location || '');
        setCity(data.city || '');
        setState(data.state || '');
        setCountry(data.country || 'India');
        setBuildingsCount(data.buildings_count || 1);
        setFloorsCount(data.floors_count || 1);
        setApproxUsersCount(data.approx_users_count || 0);
        setOperatingHours(data.operating_hours || '24/7 Operations');

        setAdminName(data.admin_name || '');
        setAdminEmail(data.admin_email || '');
        setAdminRole(data.admin_role || 'Facility Director');
        setAdminPhone(data.admin_phone || '');

        setCategories(data.categories || []);
        setLoading(false);
      })
      .catch((err) => {
        setMessage({ type: 'error', text: err.message || 'Failed to load organization settings' });
        setLoading(false);
      });
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSaveSettings = async () => {
    if (!name.trim()) {
      setMessage({ type: 'error', text: 'Organization name cannot be empty.' });
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const res = await updateOrganizationSettings({
        name: name.trim(),
        org_type: orgType,
        primary_location: primaryLocation.trim(),
        city: city.trim(),
        state: state.trim(),
        country: country.trim(),
        buildings_count: Number(buildingsCount) || 1,
        floors_count: Number(floorsCount) || 1,
        approx_users_count: Number(approxUsersCount) || 0,
        operating_hours: operatingHours.trim(),
        admin_name: adminName.trim(),
        admin_username: adminUsername.trim() || undefined,
        admin_password: adminPassword.trim() || undefined,
        admin_email: adminEmail.trim() || undefined,
        admin_role: adminRole.trim(),
        admin_phone: adminPhone.trim() || undefined,
        categories,
        gemini_api_key: geminiKey.trim() || undefined,
      });

      setOrg(res.organization);
      onOrganizationUpdated(res.organization);
      setMessage({ type: 'success', text: 'Organization profile updated successfully.' });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to save changes' });
    } finally {
      setSaving(false);
    }
  };

  const handleVerifyKey = async () => {
    if (!geminiKey.trim()) return;
    setVerifyingKey(true);
    setKeyVerifyResult(null);
    try {
      const res = await verifyGeminiApiKey(geminiKey.trim());
      setKeyVerifyResult(res);
    } catch (err: any) {
      setKeyVerifyResult({ valid: false, message: err.message || 'Verification failed' });
    } finally {
      setVerifyingKey(false);
    }
  };

  const handleAddCategory = () => {
    const trimmed = newCatInput.trim();
    if (trimmed && !categories.includes(trimmed)) {
      setCategories((prev) => [...prev, trimmed]);
      setNewCatInput('');
    }
  };

  const handleRemoveCategory = (catToRemove: string) => {
    setCategories((prev) => prev.filter((c) => c !== catToRemove));
  };

  const handleLoadDemoWorkspace = async () => {
    setIsLoadingDemo(true);
    setMessage(null);
    try {
      const res = await loadDemoWorkspace();
      setOrg(res.organization);
      onOrganizationUpdated(res.organization);
      setMessage({ type: 'success', text: 'Demo workspace data loaded successfully!' });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to seed demo data' });
    } finally {
      setIsLoadingDemo(false);
    }
  };

  const handleResetWorkspace = async () => {
    if (resetConfirmInput !== 'CONFIRM_RESET') {
      return;
    }
    setIsResetting(true);
    try {
      await resetWorkspaceData('CONFIRM_RESET');
      setShowResetConfirm(false);
      setResetConfirmInput('');
      setMessage({ type: 'success', text: 'Workspace successfully reset to clean state (0 records).' });
      // Refresh organization
      const updated = await fetchOrganizationSettings();
      setOrg(updated);
      onOrganizationUpdated(updated);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Reset failed' });
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md animate-in fade-in duration-200 font-mono">
      <div className="w-full max-w-3xl bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-zinc-900 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Building className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white font-sans">
                Organization &amp; Facility Settings
              </h2>
              <p className="text-[11px] text-zinc-400">
                {org?.name || 'Facility Configuration'} &bull; Type: {org?.org_type || 'Standard'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation Sub-Tabs */}
        <div className="flex items-center gap-2 px-6 py-2.5 bg-zinc-950 border-b border-zinc-850 overflow-x-auto text-xs">
          {[
            { id: 'profile', label: 'Facility Profile', icon: Building },
            { id: 'admin', label: 'Admin Contact', icon: User },
            { id: 'categories', label: 'Equipment Categories', icon: Layers },
            { id: 'ai', label: 'Gemini AI Engine', icon: Key },
            { id: 'data', label: 'Workspace Data', icon: Database },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id as any)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                activeTab === id
                  ? 'bg-zinc-800 text-emerald-300 border border-zinc-700 font-semibold'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{label}</span>
            </button>
          ))}
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1 text-xs">
          {message && (
            <div
              className={`p-3 rounded-lg border flex items-center gap-2 ${
                message.type === 'success'
                  ? 'bg-emerald-950/40 border-emerald-600/80 text-emerald-300'
                  : 'bg-red-950/40 border-red-800/80 text-red-300'
              }`}
            >
              {message.type === 'success' ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
              ) : (
                <AlertTriangle className="h-4 w-4 shrink-0 text-red-400" />
              )}
              <span>{message.text}</span>
            </div>
          )}

          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center space-y-2 text-zinc-400">
              <Loader2 className="h-6 w-6 animate-spin text-emerald-400" />
              <span>Loading organization profile...</span>
            </div>
          ) : (
            <>
              {/* TAB 1: Profile */}
              {activeTab === 'profile' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-zinc-300 font-semibold">Organization Name *</label>
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-white"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-zinc-300 font-semibold">Facility Type</label>
                      <select
                        value={orgType}
                        onChange={(e) => setOrgType(e.target.value)}
                        className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-white"
                      >
                        <option value="College">College / Institute</option>
                        <option value="University">University Campus</option>
                        <option value="School">School (K-12)</option>
                        <option value="Hospital">Hospital / Healthcare</option>
                        <option value="Corporate Office">Corporate / IT Park</option>
                        <option value="Hotel">Hotel &amp; Hospitality</option>
                        <option value="Factory">Manufacturing Plant</option>
                        <option value="Warehouse">Warehouse / Logistics</option>
                        <option value="Government">Government Facility</option>
                        <option value="Residential">Residential Society</option>
                        <option value="Retail">Shopping Mall / Retail</option>
                        <option value="Custom">Custom Facility</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="space-y-1">
                      <label className="text-zinc-400 text-[11px]">Primary Location</label>
                      <input
                        type="text"
                        value={primaryLocation}
                        onChange={(e) => setPrimaryLocation(e.target.value)}
                        className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-white"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-zinc-400 text-[11px]">City</label>
                      <input
                        type="text"
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-white"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-zinc-400 text-[11px]">State</label>
                      <input
                        type="text"
                        value={state}
                        onChange={(e) => setState(e.target.value)}
                        className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-white"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-zinc-400 text-[11px]">Operating Hours</label>
                      <input
                        type="text"
                        value={operatingHours}
                        onChange={(e) => setOperatingHours(e.target.value)}
                        className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-white"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <label className="text-zinc-400 text-[11px]">Total Buildings</label>
                      <input
                        type="number"
                        min={1}
                        value={buildingsCount}
                        onChange={(e) => setBuildingsCount(Number(e.target.value))}
                        className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-white"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-zinc-400 text-[11px]">Total Floors</label>
                      <input
                        type="number"
                        min={1}
                        value={floorsCount}
                        onChange={(e) => setFloorsCount(Number(e.target.value))}
                        className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-white"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-zinc-400 text-[11px]">Approx Occupants</label>
                      <input
                        type="number"
                        min={0}
                        value={approxUsersCount}
                        onChange={(e) => setApproxUsersCount(Number(e.target.value))}
                        className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-white"
                      />
                    </div>
                  </div>

                  {onOpenEquipmentInventory && (
                    <div className="pt-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          onClose();
                          onOpenEquipmentInventory();
                        }}
                        className="border-zinc-700 hover:border-emerald-500 text-emerald-400 text-xs flex items-center gap-1.5"
                      >
                        <Layers className="h-3.5 w-3.5" />
                        Manage Equipment Assets &amp; Physical Inventory &rarr;
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: Admin Contact */}
              {activeTab === 'admin' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-zinc-300 font-semibold">Admin Full Name</label>
                      <input
                        type="text"
                        value={adminName}
                        onChange={(e) => setAdminName(e.target.value)}
                        className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-white"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-zinc-300 font-semibold">Designation / Role</label>
                      <input
                        type="text"
                        value={adminRole}
                        onChange={(e) => setAdminRole(e.target.value)}
                        className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-white"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-zinc-300 font-semibold">Official Email</label>
                      <input
                        type="email"
                        value={adminEmail}
                        onChange={(e) => setAdminEmail(e.target.value)}
                        className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-white"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-zinc-300 font-semibold">Phone / WhatsApp</label>
                      <input
                        type="tel"
                        value={adminPhone}
                        onChange={(e) => setAdminPhone(e.target.value)}
                        className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-white"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-zinc-300 font-semibold text-emerald-400">Admin Login Username</label>
                      <input
                        type="text"
                        value={adminUsername}
                        onChange={(e) => setAdminUsername(e.target.value)}
                        placeholder="e.g. admin"
                        className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-white font-mono"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-zinc-300 font-semibold text-emerald-400">Change Admin Password</label>
                      <input
                        type="password"
                        value={adminPassword}
                        onChange={(e) => setAdminPassword(e.target.value)}
                        placeholder="Leave blank to keep current password"
                        className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-white font-mono placeholder:text-zinc-600"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: Categories */}
              {activeTab === 'categories' && (
                <div className="space-y-4">
                  <div>
                    <h4 className="font-semibold text-white mb-1">Active Infrastructure Categories</h4>
                    <p className="text-zinc-400 text-[11px]">
                      These categories appear in complaint dropdowns, RAG vector filters, and technician assignment rules.
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto p-2 rounded-lg border border-zinc-850 bg-zinc-900/40">
                    {categories.map((cat) => (
                      <span
                        key={cat}
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-zinc-800 text-zinc-200 border border-zinc-700 text-xs"
                      >
                        <span>{cat}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveCategory(cat)}
                          className="text-zinc-400 hover:text-red-400 ml-1"
                        >
                          &times;
                        </button>
                      </span>
                    ))}
                  </div>

                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newCatInput}
                      onChange={(e) => setNewCatInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddCategory();
                        }
                      }}
                      placeholder="Add new equipment category..."
                      className="flex-1 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-white"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleAddCategory}
                      className="border-zinc-700 text-xs flex items-center gap-1"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Add
                    </Button>
                  </div>
                </div>
              )}

              {/* TAB 4: Gemini AI Key */}
              {activeTab === 'ai' && (
                <div className="space-y-4">
                  <div>
                    <h4 className="font-semibold text-white mb-1">Gemini AI Key &amp; Reasoning Engine</h4>
                    <p className="text-zinc-400 text-[11px]">
                      Google Gemini 2.5 Flash powers real-time conversational assistance, root cause synthesis, and work order recommendations.
                    </p>
                  </div>

                  <div className="p-3.5 rounded-xl border border-zinc-800 bg-zinc-900/40 space-y-3">
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-zinc-300 font-semibold flex items-center gap-1.5">
                          <Key className="h-3.5 w-3.5 text-emerald-400" />
                          Update Gemini API Key
                        </label>
                        {org?.gemini_api_key_configured && (
                          <Badge variant="outline" className="text-emerald-400 border-emerald-800 text-[10px]">
                            Configured &amp; Active
                          </Badge>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <input
                          type="password"
                          value={geminiKey}
                          onChange={(e) => {
                            setGeminiKey(e.target.value);
                            setKeyVerifyResult(null);
                          }}
                          placeholder={org?.gemini_api_key_configured ? '••••••••••••••••••••' : 'AIzaSy...'}
                          className="flex-1 rounded-lg border border-zinc-800 bg-black px-3 py-2 text-white font-mono text-xs"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          disabled={!geminiKey.trim() || verifyingKey}
                          onClick={handleVerifyKey}
                          className="border-emerald-700/60 hover:border-emerald-500 text-emerald-300 text-xs flex items-center gap-1 shrink-0"
                        >
                          {verifyingKey ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Zap className="h-3.5 w-3.5" />
                          )}
                          Test Key
                        </Button>
                      </div>
                    </div>

                    {keyVerifyResult && (
                      <div
                        className={`p-2.5 rounded-lg border text-xs flex items-center gap-2 ${
                          keyVerifyResult.valid
                            ? 'bg-emerald-950/40 border-emerald-600/80 text-emerald-300'
                            : 'bg-red-950/40 border-red-800/80 text-red-300'
                        }`}
                      >
                        {keyVerifyResult.valid ? (
                          <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
                        ) : (
                          <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-red-400" />
                        )}
                        <span>{keyVerifyResult.message}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 5: Workspace Data Management */}
              {activeTab === 'data' && (
                <div className="space-y-4">
                  <div>
                    <h4 className="font-semibold text-white mb-1">Workspace Lifecycle &amp; Maintenance</h4>
                    <p className="text-zinc-400 text-[11px]">
                      Manage operational records, on-demand demo datasets, or reset the workspace for a fresh launch.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Load Demo Data */}
                    <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/40 space-y-3">
                      <div className="flex items-center gap-2">
                        <Database className="h-4 w-4 text-sky-400" />
                        <span className="font-bold text-white text-xs">Load Demo Dataset</span>
                      </div>
                      <p className="text-zinc-400 text-[11px] leading-relaxed">
                        Seeds sample complaints, historical maintenance embeddings, and verified technicians for quick presentations and feature exploration.
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        disabled={isLoadingDemo}
                        onClick={handleLoadDemoWorkspace}
                        className="w-full border-sky-700/60 hover:border-sky-500 text-sky-300 text-xs flex items-center justify-center gap-1.5"
                      >
                        {isLoadingDemo ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Sparkles className="h-3.5 w-3.5" />
                        )}
                        Load Demo Workspace
                      </Button>
                    </div>

                    {/* Factory Reset */}
                    <div className="p-4 rounded-xl border border-red-900/50 bg-red-950/20 space-y-3">
                      <div className="flex items-center gap-2">
                        <Trash2 className="h-4 w-4 text-red-400" />
                        <span className="font-bold text-red-300 text-xs">Factory Reset Workspace</span>
                      </div>
                      <p className="text-zinc-400 text-[11px] leading-relaxed">
                        Clears all operational complaints, work orders, vector knowledge records, and resets the system to 0 records.
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setShowResetConfirm(true)}
                        className="w-full border-red-700/80 hover:bg-red-900/30 text-red-400 text-xs flex items-center justify-center gap-1.5"
                      >
                        <AlertTriangle className="h-3.5 w-3.5" />
                        Factory Reset System...
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-zinc-950 border-t border-zinc-850 flex items-center justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="border-zinc-800 text-zinc-300 text-xs"
          >
            Close
          </Button>

          <Button
            type="button"
            disabled={saving || loading}
            onClick={handleSaveSettings}
            className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs flex items-center gap-1.5"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            <span>Save Configuration</span>
          </Button>
        </div>
      </div>

      {/* Confirmation Modal for Reset */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
          <div className="w-full max-w-md bg-zinc-950 border border-red-900 rounded-2xl p-5 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-red-400">
              <AlertTriangle className="h-6 w-6 shrink-0" />
              <h3 className="font-bold text-sm text-white">Confirm Factory Reset</h3>
            </div>
            <p className="text-zinc-300 text-xs leading-relaxed">
              This will permanently delete all active complaints, work orders, vector knowledge embeddings, and equipment records.
            </p>
            <div className="space-y-2">
              <label className="text-zinc-400 text-[11px]">
                Type <span className="text-red-400 font-bold">CONFIRM_RESET</span> below to proceed:
              </label>
              <input
                type="text"
                value={resetConfirmInput}
                onChange={(e) => setResetConfirmInput(e.target.value)}
                placeholder="CONFIRM_RESET"
                className="w-full rounded-lg border border-red-800 bg-black px-3 py-2 text-white font-mono text-xs focus:border-red-500 focus:outline-none"
              />
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowResetConfirm(false);
                  setResetConfirmInput('');
                }}
                className="border-zinc-800 text-zinc-300 text-xs"
              >
                Cancel
              </Button>
              <Button
                type="button"
                disabled={resetConfirmInput !== 'CONFIRM_RESET' || isResetting}
                onClick={handleResetWorkspace}
                className="bg-red-600 hover:bg-red-500 text-white text-xs flex items-center gap-1.5"
              >
                {isResetting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                Confirm Factory Reset
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
