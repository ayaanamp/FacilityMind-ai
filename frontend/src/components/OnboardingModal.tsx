import React, { useEffect, useState } from 'react';
import {
  Building,
  Building2,
  CheckCircle2,
  Database,
  Factory,
  GraduationCap,
  HeartPulse,
  Hotel,
  Key,
  Layers,
  Loader2,
  Plus,
  Shield,
  Sparkles,
  User,
  Zap,
} from 'lucide-react';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { fetchSuggestedCategories, loginAdmin, setupOrganization, verifyGeminiApiKey } from '../services/api';
import { OrganizationProfile } from '../types';

interface OnboardingModalProps {
  isOpen: boolean;
  onComplete: (org: OrganizationProfile) => void;
}

const ORG_TYPES = [
  { id: 'College', label: 'College / Institute', icon: GraduationCap, desc: 'Labs, lecture halls, campus utilities, hostel infrastructure' },
  { id: 'University', label: 'University Campus', icon: GraduationCap, desc: 'Multi-block academic buildings, research facilities, sports & central utilities' },
  { id: 'School', label: 'School (K-12)', icon: GraduationCap, desc: 'Classrooms, computer lab, sports grounds, cafeteria, school buses' },
  { id: 'Hospital', label: 'Hospital / Healthcare', icon: HeartPulse, desc: 'Critical ICUs, operation theaters, medical gas, backup generators' },
  { id: 'Corporate Office', label: 'Corporate / IT Park', icon: Building2, desc: 'HVAC chillers, server rooms, smart lighting, elevator banks' },
  { id: 'Hotel', label: 'Hotel & Hospitality', icon: Hotel, desc: 'Guest rooms, kitchen equipment, laundry, swimming pool, lifts' },
  { id: 'Factory', label: 'Manufacturing Plant', icon: Factory, desc: 'Production machinery, air compressors, industrial power, safety systems' },
  { id: 'Warehouse', label: 'Warehouse / Logistics', icon: Building, desc: 'Forklifts, conveyors, cold storage, dock levelers, fire suppression' },
  { id: 'Government', label: 'Government Facility', icon: Shield, desc: 'Civic buildings, public counters, security checkpoints, archives' },
  { id: 'Residential', label: 'Residential Society', icon: Building2, desc: 'Clubhouse, water filtration, lifts, common area lighting, parking' },
  { id: 'Retail', label: 'Shopping Mall / Retail', icon: Layers, desc: 'Escalators, central AC, tenant sub-panels, facade lighting' },
  { id: 'Custom', label: 'Custom / Other Facility', icon: Building, desc: 'Define your own specialized infrastructure profile and categories' },
];

export const OnboardingModal: React.FC<OnboardingModalProps> = ({ isOpen, onComplete }) => {
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [adminName, setAdminName] = useState('');
  const [adminUsername, setAdminUsername] = useState('admin');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminRole, setAdminRole] = useState('Facility Director');
  const [adminPhone, setAdminPhone] = useState('');

  const [orgName, setOrgName] = useState('');
  const [orgType, setOrgType] = useState('College');
  const [customOrgType, setCustomOrgType] = useState('');
  const [primaryLocation, setPrimaryLocation] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [country] = useState('India');
  const [buildingsCount, setBuildingsCount] = useState(3);
  const [floorsCount, setFloorsCount] = useState(4);
  const [approxUsersCount, setApproxUsersCount] = useState(2500);
  const [operatingHours, setOperatingHours] = useState('24/7 Operations');
  const [blocks, setBlocks] = useState<string[]>(['Block A (Main Building)', 'Block B (Science Labs)', 'Block C (Auditorium & Admin)']);

  // Categories
  const [categories, setCategories] = useState<string[]>([]);
  const [customCatInput, setCustomCatInput] = useState('');
  const [loadingCategories, setLoadingCategories] = useState(false);

  // Gemini API Key
  const [geminiKey, setGeminiKey] = useState('');
  const [verifyingKey, setVerifyingKey] = useState(false);
  const [keyVerifyResult, setKeyVerifyResult] = useState<{ valid: boolean; message: string } | null>(null);

  // Mode Selection
  const [loadDemoData, setLoadDemoData] = useState(false);

  // Fetch suggested categories when orgType changes
  useEffect(() => {
    if (!isOpen) return;
    setLoadingCategories(true);
    fetchSuggestedCategories(orgType)
      .then((cats) => {
        setCategories(cats);
        setLoadingCategories(false);
      })
      .catch(() => {
        setLoadingCategories(false);
      });
  }, [orgType, isOpen]);

  if (!isOpen) return null;

  const handleToggleCategory = (cat: string) => {
    setCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  };

  const handleAddCustomCategory = () => {
    const trimmed = customCatInput.trim();
    if (trimmed && !categories.includes(trimmed)) {
      setCategories((prev) => [...prev, trimmed]);
      setCustomCatInput('');
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
      setKeyVerifyResult({ valid: false, message: err.message || 'Key verification failed' });
    } finally {
      setVerifyingKey(false);
    }
  };

  const handleCompleteSetup = async () => {
    if (!orgName.trim()) {
      setError('Please enter your organization name.');
      setStep(2);
      return;
    }
    if (!adminName.trim()) {
      setError('Please enter the administrator full name.');
      setStep(1);
      return;
    }
    if (!adminUsername.trim()) {
      setError('Please enter an administrator login username.');
      setStep(1);
      return;
    }
    if (!adminPassword.trim() || adminPassword.length < 3) {
      setError('Please enter an administrator password (at least 3 characters).');
      setStep(1);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await setupOrganization({
        admin_name: adminName.trim(),
        admin_username: adminUsername.trim(),
        admin_password: adminPassword.trim(),
        admin_email: adminEmail.trim() || undefined,
        admin_role: adminRole.trim() || 'Facility Director',
        admin_phone: adminPhone.trim() || undefined,
        organization_name: orgName.trim(),
        org_type: orgType === 'Custom' && customOrgType.trim() ? customOrgType.trim() : orgType,
        custom_org_type: orgType === 'Custom' ? customOrgType.trim() : undefined,
        country,
        state: state.trim(),
        city: city.trim(),
        primary_location: primaryLocation.trim() || (city.trim() ? `${city.trim()} Campus` : 'Main Campus'),
        buildings_count: Number(buildingsCount) || 1,
        floors_count: Number(floorsCount) || 1,
        approx_users_count: Number(approxUsersCount) || 0,
        operating_hours: operatingHours.trim() || '24/7 Operations',
        categories: categories.length > 0 ? categories : ['HVAC', 'Electrical', 'Plumbing', 'Elevator'],
        blocks: blocks.length > 0 ? blocks : ['Main Campus Block A', 'Service Block B'],
        gemini_api_key: geminiKey.trim() || undefined,
        load_demo_data: loadDemoData,
      });

      // Save remembered admin credentials
      localStorage.setItem('fm_last_admin_username', adminUsername.trim());
      localStorage.setItem('fm_saved_admin_password', adminPassword.trim());
      localStorage.setItem('fm_remember_admin', 'true');

      // Attempt immediate auto-login for seamless first experience
      try {
        await loginAdmin({
          username: adminUsername.trim(),
          password: adminPassword.trim(),
        });
      } catch (loginErr) {
        console.warn('Post-onboarding auto-login note:', loginErr);
      }

      onComplete(res);
    } catch (err: any) {
      setError(err.message || 'Failed to initialize organization workspace');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/90 backdrop-blur-xl animate-in fade-in duration-200">
      <div className="w-full max-w-3xl bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header with Steps */}
        <div className="bg-gradient-to-r from-zinc-900 via-zinc-950 to-zinc-900 px-6 py-5 border-b border-zinc-850">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white tracking-wide">
                  Welcome to FacilityMind AI
                </h2>
                <p className="text-xs text-zinc-400">
                  First-Time Organization & Facility Onboarding Setup
                </p>
              </div>
            </div>
            <Badge variant="outline" className="border-emerald-500/40 text-emerald-300 font-mono text-xs">
              Step {step} of 5
            </Badge>
          </div>

          {/* Stepper Progress Bar */}
          <div className="grid grid-cols-5 gap-2 mt-4">
            {[
              { s: 1, label: 'Admin Profile' },
              { s: 2, label: 'Facility Info' },
              { s: 3, label: 'Categories' },
              { s: 4, label: 'AI Config' },
              { s: 5, label: 'Workspace' },
            ].map(({ s, label }) => (
              <button
                key={s}
                onClick={() => setStep(s as any)}
                disabled={loading}
                className={`text-left text-[11px] font-mono py-1 border-t-2 transition-all ${
                  step === s
                    ? 'border-emerald-400 text-white font-bold'
                    : step > s
                    ? 'border-emerald-700/60 text-emerald-400'
                    : 'border-zinc-800 text-zinc-600'
                }`}
              >
                {s}. {label}
              </button>
            ))}
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs font-mono">
          {error && (
            <div className="p-3.5 rounded-lg bg-red-950/40 border border-red-800/80 text-red-300 flex items-center gap-2">
              <Shield className="h-4 w-4 shrink-0 text-red-400" />
              <span>{error}</span>
            </div>
          )}

          {/* STEP 1: Admin Profile */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-bold text-white mb-1">
                  1. Facility Administrator Details
                </h3>
                <p className="text-zinc-400">
                  Enter the primary contact overseeing campus & facility maintenance operations.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-zinc-300 font-semibold flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5 text-emerald-400" />
                    Administrator Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={adminName}
                    onChange={(e) => setAdminName(e.target.value)}
                    placeholder="e.g. Dr. Rajesh Sharma"
                    className="w-full rounded-lg border border-zinc-800 bg-zinc-900/80 px-3.5 py-2.5 text-white placeholder-zinc-500 focus:border-emerald-500 focus:outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-zinc-300 font-semibold">
                    Admin Official Role / Designation
                  </label>
                  <input
                    type="text"
                    value={adminRole}
                    onChange={(e) => setAdminRole(e.target.value)}
                    placeholder="e.g. Facility Director / Estate Officer"
                    className="w-full rounded-lg border border-zinc-800 bg-zinc-900/80 px-3.5 py-2.5 text-white placeholder-zinc-500 focus:border-emerald-500 focus:outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-zinc-300 font-semibold flex items-center gap-1.5">
                    <Key className="h-3.5 w-3.5 text-emerald-400" />
                    Admin Login Username *
                  </label>
                  <input
                    type="text"
                    required
                    value={adminUsername}
                    onChange={(e) => setAdminUsername(e.target.value)}
                    placeholder="e.g. admin"
                    className="w-full rounded-lg border border-zinc-800 bg-zinc-900/80 px-3.5 py-2.5 text-white placeholder-zinc-500 focus:border-emerald-500 focus:outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-zinc-300 font-semibold flex items-center gap-1.5">
                    <Shield className="h-3.5 w-3.5 text-emerald-400" />
                    Admin Login Password *
                  </label>
                  <input
                    type="password"
                    required
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    placeholder="Enter secure password"
                    className="w-full rounded-lg border border-zinc-800 bg-zinc-900/80 px-3.5 py-2.5 text-white placeholder-zinc-500 focus:border-emerald-500 focus:outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-zinc-300 font-semibold">
                    Official Email Address
                  </label>
                  <input
                    type="email"
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                    placeholder="admin@organization.edu"
                    className="w-full rounded-lg border border-zinc-800 bg-zinc-900/80 px-3.5 py-2.5 text-white placeholder-zinc-500 focus:border-emerald-500 focus:outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-zinc-300 font-semibold">
                    Contact Phone / WhatsApp
                  </label>
                  <input
                    type="tel"
                    value={adminPhone}
                    onChange={(e) => setAdminPhone(e.target.value)}
                    placeholder="+91 98765 43210"
                    className="w-full rounded-lg border border-zinc-800 bg-zinc-900/80 px-3.5 py-2.5 text-white placeholder-zinc-500 focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: Organization Profile */}
          {step === 2 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-bold text-white mb-1">
                  2. Organization & Facility Profile
                </h3>
                <p className="text-zinc-400">
                  Select your organization type and configure campus infrastructure parameters.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-zinc-300 font-semibold">
                  Organization / Institution Name *
                </label>
                <input
                  type="text"
                  required
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  placeholder="e.g. National Institute of Technology / Apex Healthcare Corp."
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-900/80 px-3.5 py-2.5 text-white placeholder-zinc-500 focus:border-emerald-500 focus:outline-none text-sm font-sans"
                />
              </div>

              {/* Organization Type Grid */}
              <div className="space-y-1.5">
                <label className="text-zinc-300 font-semibold">
                  Facility / Organization Type *
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto p-1 border border-zinc-850 rounded-lg bg-zinc-900/30">
                  {ORG_TYPES.map((type) => {
                    const Icon = type.icon;
                    const isSelected = orgType === type.id;
                    return (
                      <div
                        key={type.id}
                        onClick={() => setOrgType(type.id)}
                        className={`p-2.5 rounded-lg border cursor-pointer transition-all flex flex-col justify-between ${
                          isSelected
                            ? 'bg-emerald-950/40 border-emerald-500 text-white shadow-sm shadow-emerald-500/10'
                            : 'bg-zinc-900/50 border-zinc-800/80 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 mb-1">
                          <Icon className={`h-4 w-4 shrink-0 ${isSelected ? 'text-emerald-400' : 'text-zinc-500'}`} />
                          <span className="font-bold text-[11px] truncate">{type.label}</span>
                        </div>
                        <p className="text-[9.5px] text-zinc-500 line-clamp-2 leading-tight">
                          {type.desc}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {orgType === 'Custom' && (
                <div className="space-y-1.5">
                  <label className="text-zinc-300 font-semibold">Custom Facility Type Name</label>
                  <input
                    type="text"
                    value={customOrgType}
                    onChange={(e) => setCustomOrgType(e.target.value)}
                    placeholder="e.g. Airport Terminal / Theme Park"
                    className="w-full rounded-lg border border-zinc-800 bg-zinc-900/80 px-3.5 py-2 text-white"
                  />
                </div>
              )}

              {/* Physical Parameters */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                <div className="space-y-1">
                  <label className="text-zinc-400 text-[11px]">Primary Location</label>
                  <input
                    type="text"
                    value={primaryLocation}
                    onChange={(e) => setPrimaryLocation(e.target.value)}
                    placeholder="e.g. North Campus"
                    className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-white text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-zinc-400 text-[11px]">City / Region</label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="e.g. Bengaluru"
                    className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-white text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-zinc-400 text-[11px]">State / Province</label>
                  <input
                    type="text"
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    placeholder="e.g. Karnataka"
                    className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-white text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-zinc-400 text-[11px]">Operating Hours</label>
                  <input
                    type="text"
                    value={operatingHours}
                    onChange={(e) => setOperatingHours(e.target.value)}
                    placeholder="e.g. 24/7 or 08:00 - 20:00"
                    className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-white text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-zinc-400 text-[11px]">Buildings Count</label>
                  <input
                    type="number"
                    min={1}
                    value={buildingsCount}
                    onChange={(e) => setBuildingsCount(Number(e.target.value))}
                    className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-white text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-zinc-400 text-[11px]">Total Floors</label>
                  <input
                    type="number"
                    min={1}
                    value={floorsCount}
                    onChange={(e) => setFloorsCount(Number(e.target.value))}
                    className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-white text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-zinc-400 text-[11px]">Approx Occupants</label>
                  <input
                    type="number"
                    min={0}
                    value={approxUsersCount}
                    onChange={(e) => setApproxUsersCount(Number(e.target.value))}
                    className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-white text-xs"
                  />
                </div>
              </div>

              <div className="space-y-1.5 pt-1">
                <label className="text-zinc-300 font-semibold flex items-center justify-between">
                  <span>Campus Blocks / Wings / Zones</span>
                  <span className="text-[10px] text-zinc-500 font-normal">Comma-separated</span>
                </label>
                <input
                  type="text"
                  value={blocks.join(', ')}
                  onChange={(e) =>
                    setBlocks(
                      e.target.value
                        .split(',')
                        .map((b) => b.trim())
                        .filter(Boolean)
                    )
                  }
                  placeholder="e.g. Block A, Block B (Labs), Main Library, Admin Quad"
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3.5 py-2.5 text-white text-xs"
                />
              </div>
            </div>
          )}

          {/* STEP 3: Infrastructure Categories */}
          {step === 3 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-bold text-white mb-1">
                  3. Suggested Infrastructure Categories
                </h3>
                <p className="text-zinc-400">
                  AI has suggested these categories tailored for a <span className="text-emerald-400 font-bold">{orgType}</span>. Toggle the active equipment types for your facility.
                </p>
              </div>

              {loadingCategories ? (
                <div className="py-8 flex items-center justify-center gap-2 text-zinc-400">
                  <Loader2 className="h-4 w-4 animate-spin text-emerald-400" />
                  <span>Loading domain category intelligence...</span>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto p-1 border border-zinc-850 rounded-lg bg-zinc-900/30">
                  {categories.map((cat) => {
                    const isSelected = categories.includes(cat);
                    return (
                      <div
                        key={cat}
                        onClick={() => handleToggleCategory(cat)}
                        className={`p-2.5 rounded-lg border cursor-pointer transition-all flex items-center justify-between ${
                          isSelected
                            ? 'bg-emerald-950/30 border-emerald-500/70 text-zinc-100'
                            : 'bg-zinc-900/40 border-zinc-800 text-zinc-500 line-through'
                        }`}
                      >
                        <span className="font-sans font-medium text-xs">{cat}</span>
                        <CheckCircle2 className={`h-4 w-4 ${isSelected ? 'text-emerald-400' : 'text-zinc-700'}`} />
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Add Custom Category */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={customCatInput}
                  onChange={(e) => setCustomCatInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddCustomCategory();
                    }
                  }}
                  placeholder="Add custom category (e.g. Solar Inverter / Oxygen Plant)..."
                  className="flex-1 rounded-lg border border-zinc-800 bg-zinc-900 px-3.5 py-2 text-white text-xs placeholder-zinc-500"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleAddCustomCategory}
                  className="border-zinc-700 hover:border-zinc-500 text-xs flex items-center gap-1.5"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add
                </Button>
              </div>
            </div>
          )}

          {/* STEP 4: Gemini AI Key Setup */}
          {step === 4 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-bold text-white mb-1">
                  4. Google Gemini AI Engine Configuration
                </h3>
                <p className="text-zinc-400">
                  FacilityMind AI uses Google Gemini 2.5 Flash for conversational intelligence and deep reasoning.
                </p>
              </div>

              <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/40 space-y-3">
                <div className="space-y-1.5">
                  <label className="text-zinc-300 font-semibold flex items-center gap-1.5">
                    <Key className="h-3.5 w-3.5 text-emerald-400" />
                    Gemini API Key (Optional)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="password"
                      value={geminiKey}
                      onChange={(e) => {
                        setGeminiKey(e.target.value);
                        setKeyVerifyResult(null);
                      }}
                      placeholder="AIzaSy..."
                      className="flex-1 rounded-lg border border-zinc-800 bg-black px-3.5 py-2.5 text-white font-mono text-xs focus:border-emerald-500 focus:outline-none"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      disabled={!geminiKey.trim() || verifyingKey}
                      onClick={handleVerifyKey}
                      className="border-emerald-700/60 hover:border-emerald-500 text-emerald-300 text-xs flex items-center gap-1.5 shrink-0"
                    >
                      {verifyingKey ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Zap className="h-3.5 w-3.5" />
                      )}
                      Test &amp; Verify
                    </Button>
                  </div>
                </div>

                {keyVerifyResult && (
                  <div
                    className={`p-3 rounded-lg border flex items-center gap-2 ${
                      keyVerifyResult.valid
                        ? 'bg-emerald-950/40 border-emerald-600/80 text-emerald-300'
                        : 'bg-red-950/40 border-red-800/80 text-red-300'
                    }`}
                  >
                    {keyVerifyResult.valid ? (
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                    ) : (
                      <Shield className="h-4 w-4 shrink-0 text-red-400" />
                    )}
                    <span>{keyVerifyResult.message}</span>
                  </div>
                )}

                <div className="text-[11px] text-zinc-400 space-y-1 bg-zinc-950/60 p-3 rounded-lg border border-zinc-850">
                  <p className="font-semibold text-zinc-300">💡 Key Security &amp; Offline Operation:</p>
                  <p>&bull; The API key is stored securely in your local environment file and never exposed in frontend bundles.</p>
                  <p>&bull; If left empty, FacilityMind automatically uses its built-in rule engine, TF-IDF vector RAG, and engineering heuristic fallbacks.</p>
                </div>
              </div>
            </div>
          )}

          {/* STEP 5: Startup Mode */}
          {step === 5 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-bold text-white mb-1">
                  5. Initialize Workspace Mode
                </h3>
                <p className="text-zinc-400">
                  Choose whether to start with a 100% clean installation or preload sample demo scenarios.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div
                  onClick={() => setLoadDemoData(false)}
                  className={`p-4 rounded-xl border cursor-pointer transition-all ${
                    !loadDemoData
                      ? 'bg-emerald-950/30 border-emerald-500 shadow-md shadow-emerald-500/10'
                      : 'bg-zinc-900/40 border-zinc-800 hover:border-zinc-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-5 w-5 text-emerald-400" />
                      <span className="font-bold text-white text-sm">Clean Fresh Workspace</span>
                    </div>
                    {!loadDemoData && <Badge className="bg-emerald-600 text-white text-[10px]">Selected (Recommended)</Badge>}
                  </div>
                  <p className="text-zinc-400 text-[11px] leading-relaxed">
                    Starts completely empty: 0 complaints, 0 fake work orders, 0 random staff. Ready for real production equipment and live complaint triage.
                  </p>
                </div>

                <div
                  onClick={() => setLoadDemoData(true)}
                  className={`p-4 rounded-xl border cursor-pointer transition-all ${
                    loadDemoData
                      ? 'bg-emerald-950/30 border-emerald-500 shadow-md shadow-emerald-500/10'
                      : 'bg-zinc-900/40 border-zinc-800 hover:border-zinc-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Database className="h-5 w-5 text-sky-400" />
                      <span className="font-bold text-white text-sm">Pre-Loaded Demo Data</span>
                    </div>
                    {loadDemoData && <Badge className="bg-sky-600 text-white text-[10px]">Selected</Badge>}
                  </div>
                  <p className="text-zinc-400 text-[11px] leading-relaxed">
                    Loads sample complaints, realistic maintenance history vector embeddings, and on-duty technician profiles for quick testing and presentations.
                  </p>
                </div>
              </div>

              {/* Summary of Configuration */}
              <div className="bg-zinc-900/60 p-3.5 rounded-xl border border-zinc-850 space-y-2">
                <div className="text-[11px] font-bold text-zinc-300">Ready to Launch FacilityMind AI with:</div>
                <div className="grid grid-cols-2 gap-2 text-[11px] text-zinc-400">
                  <div>🏢 Org: <span className="text-white font-semibold">{orgName || 'Unnamed'}</span></div>
                  <div>🏷️ Type: <span className="text-emerald-400 font-semibold">{orgType}</span></div>
                  <div>👤 Admin: <span className="text-white font-semibold">{adminName || 'Admin'}</span></div>
                  <div>📍 Location: <span className="text-white">{city || 'Main'} Campus</span></div>
                  <div>⚙️ Categories: <span className="text-white">{categories.length} enabled</span></div>
                  <div>⚡ Mode: <span className="text-white">{loadDemoData ? 'Demo Workspace' : 'Clean Start (0 records)'}</span></div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Controls */}
        <div className="bg-zinc-950 px-6 py-4 border-t border-zinc-850 flex items-center justify-between">
          <div>
            {step > 1 && (
              <Button
                type="button"
                variant="outline"
                disabled={loading}
                onClick={() => setStep((prev) => (prev - 1) as any)}
                className="border-zinc-800 hover:bg-zinc-900 text-zinc-300 text-xs font-mono"
              >
                Back
              </Button>
            )}
          </div>

          <div className="flex items-center gap-3">
            {step < 5 ? (
              <Button
                type="button"
                onClick={() => {
                  if (step === 1 && !adminName.trim()) {
                    setError('Please enter administrator full name.');
                    return;
                  }
                  if (step === 2 && !orgName.trim()) {
                    setError('Please enter organization name.');
                    return;
                  }
                  setError(null);
                  setStep((prev) => (prev + 1) as any);
                }}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-mono text-xs px-5 py-2"
              >
                Continue &rarr;
              </Button>
            ) : (
              <Button
                type="button"
                disabled={loading}
                onClick={handleCompleteSetup}
                className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-mono text-xs px-6 py-2 shadow-lg shadow-emerald-500/20 flex items-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Configuring Workspace...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    <span>Complete Setup &amp; Launch</span>
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
