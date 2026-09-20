import React from 'react';
import {
  Activity,
  Bell,
  Building,
  Compass,
  FileCheck2,
  FolderArchive,
  KeyRound,
  Layers,
  LogOut,
  PlusCircle,
  Settings,
  Shield,
  Sparkles,
  User,
  Users,
  Zap,
} from 'lucide-react';
import { Button } from './ui/Button';
import { AdminUser, OrganizationProfile } from '../types';

export type TabType =
  | 'dashboard'
  | 'new-complaint'
  | 'decision'
  | 'similar-cases'
  | 'history'
  | 'technicians'
  | 'health';

export type PortalMode = 'user' | 'admin';

interface NavbarProps {
  portalMode: PortalMode;
  setPortalMode: (mode: PortalMode) => void;
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  onQuickDemo?: () => void;
  organization?: OrganizationProfile | null;
  adminUser?: AdminUser | null;
  onLogoutAdmin?: () => void;
  onOpenSettings?: () => void;
  onOpenPasswordModal?: () => void;
  onOpenEquipment?: () => void;
  onOpenNotifications?: () => void;
  unreadNotificationsCount?: number;
  isWsConnected?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  portalMode,
  setPortalMode,
  activeTab,
  setActiveTab,
  onQuickDemo,
  organization,
  adminUser,
  onLogoutAdmin,
  onOpenSettings,
  onOpenPasswordModal,
  onOpenEquipment,
  onOpenNotifications,
  unreadNotificationsCount = 0,
  isWsConnected = true,
}) => {
  const adminNavItems: Array<{ id: TabType; label: string; icon: React.ComponentType<{ className?: string }> }> = [
    { id: 'dashboard', label: 'Command Center', icon: Layers },
    { id: 'new-complaint', label: 'File Complaint', icon: PlusCircle },
    { id: 'decision', label: 'Decision Report', icon: FileCheck2 },
    { id: 'similar-cases', label: 'Evidence Explorer', icon: Compass },
    { id: 'history', label: 'Knowledge Base', icon: FolderArchive },
    { id: 'technicians', label: 'Staff & Payouts', icon: Users },
    { id: 'health', label: 'Diagnostics', icon: Activity },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-zinc-850 bg-zinc-950/95 backdrop-blur-xl shadow-lg shadow-black/50">
      {/* Top Header Row */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between min-h-[3.75rem] py-2 gap-3">
          {/* Brand Logo & Title */}
          <div
            className="flex items-center gap-2.5 sm:gap-3 cursor-pointer group select-none shrink-0"
            onClick={() => {
              if (portalMode === 'admin') setActiveTab('dashboard');
            }}
          >
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-emerald-500/20 via-zinc-900 to-sky-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 group-hover:border-emerald-400 group-hover:scale-105 transition-all shadow-md shadow-emerald-500/10 shrink-0">
              <Sparkles className="h-4 w-4 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-1.5 sm:gap-2">
                <span className="font-extrabold text-base tracking-wide text-white font-sans">
                  Facility<span className="text-emerald-400">Mind</span>
                </span>
                <span className="text-[10px] font-mono font-bold uppercase px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800/80">
                  AI
                </span>
                {organization?.name && (
                  <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-mono text-zinc-300 bg-zinc-900 px-2 py-0.5 rounded-md border border-zinc-800 max-w-[190px] truncate">
                    <Building className="h-3 w-3 text-emerald-400 shrink-0" />
                    <span className="truncate">{organization.name}</span>
                  </span>
                )}
              </div>
              <p className="text-[10px] text-zinc-400 font-sans tracking-normal hidden md:block">
                {organization?.org_type
                  ? `${organization.org_type} Facility Decision Intelligence`
                  : 'Autonomous Facility Decision Intelligence'}
              </p>
            </div>
          </div>

          {/* User Portal Middle Subtitle */}
          {portalMode === 'user' && (
            <div className="hidden lg:flex items-center gap-2 text-xs text-zinc-400 font-mono">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              <span>Campus Infrastructure Support &amp; Autonomous Dispatch Portal</span>
            </div>
          )}

          {/* Right Action Controls */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Live WS Status Dot */}
            <div
              className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-zinc-900 border border-zinc-800 text-[11px] font-mono text-zinc-400"
              title={isWsConnected ? 'Real-time WebSocket Live' : 'Real-time Polling Active'}
            >
              <span className={`w-2 h-2 rounded-full ${isWsConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
              <span className="hidden sm:inline">{isWsConnected ? 'LIVE' : 'POLL'}</span>
            </div>

            {/* Notifications Bell */}
            {onOpenNotifications && (
              <button
                onClick={onOpenNotifications}
                className="relative p-2 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-zinc-700 hover:bg-zinc-850 text-zinc-300 hover:text-white transition-colors"
                title="Notifications"
              >
                <Bell className="w-3.5 h-3.5" />
                {unreadNotificationsCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 text-black text-[9px] font-bold font-mono flex items-center justify-center">
                    {unreadNotificationsCount > 9 ? '9+' : unreadNotificationsCount}
                  </span>
                )}
              </button>
            )}

            {/* Mode Specific Actions */}
            {portalMode === 'user' ? (
              <button
                onClick={() => setPortalMode('admin')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-750 transition-all shadow-sm active:scale-95"
                title="Sign in to Administrator Command Center"
              >
                <Shield className="w-3.5 h-3.5 text-emerald-400" />
                <span>Admin Sign In</span>
              </button>
            ) : (
              <div className="flex items-center gap-1 sm:gap-1.5">
                <button
                  onClick={() => setPortalMode('user')}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-800 transition-all"
                  title="Switch to Student / Complainant Portal View"
                >
                  <User className="w-3.5 h-3.5 text-zinc-400" />
                  <span className="hidden sm:inline">Student View</span>
                </button>

                {onOpenEquipment && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onOpenEquipment}
                    title="Manage Physical Equipment & Assets"
                    className="border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900 text-zinc-300 text-xs flex items-center gap-1 px-2.5 py-1.5 hidden xl:flex"
                  >
                    <Layers className="h-3.5 w-3.5 text-zinc-400" />
                    <span>Assets</span>
                  </Button>
                )}

                {onOpenSettings && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onOpenSettings}
                    title="Organization & System Settings"
                    className="border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900 text-zinc-300 text-xs flex items-center gap-1 px-2.5 py-1.5"
                  >
                    <Settings className="h-3.5 w-3.5 text-emerald-400" />
                    <span className="hidden sm:inline">Settings</span>
                  </Button>
                )}

                {/* Dedicated Change Password & Admin Name Button */}
                {onOpenPasswordModal && (
                  <button
                    onClick={onOpenPasswordModal}
                    title="Change Admin Password & Username"
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-emerald-300 hover:text-emerald-200 border border-emerald-800/60 transition-all text-xs font-mono"
                  >
                    <KeyRound className="h-3 w-3 text-emerald-400" />
                    <span className="hidden md:inline">Password</span>
                  </button>
                )}

                {adminUser && (
                  <div className="flex items-center gap-1 pl-1">
                    <span
                      onClick={onOpenPasswordModal || onOpenSettings}
                      className="text-[11px] font-mono text-zinc-300 bg-zinc-900 hover:bg-zinc-850 cursor-pointer px-2 py-1 rounded border border-zinc-800 hover:border-emerald-600 transition-all max-w-[130px] truncate"
                      title="Click to edit Admin Profile & Password"
                    >
                      {adminUser.full_name || adminUser.username}
                    </span>
                    {onLogoutAdmin && (
                      <button
                        onClick={onLogoutAdmin}
                        title="Sign Out of Admin Portal"
                        className="p-1.5 rounded-lg border border-zinc-800 hover:border-red-800 hover:bg-red-950/40 text-zinc-400 hover:text-red-300 transition-colors"
                      >
                        <LogOut className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                )}

                {onQuickDemo && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onQuickDemo}
                    className="bg-emerald-950/40 hover:bg-emerald-900/50 text-emerald-300 hover:text-emerald-200 border border-emerald-600/50 font-sans text-xs flex items-center gap-1 whitespace-nowrap shadow-sm active:scale-95 transition-all px-2.5 py-1.5 hidden md:flex"
                  >
                    <Zap className="h-3.5 w-3.5 fill-current text-emerald-400 shrink-0" />
                    <span className="font-semibold">Demo</span>
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Admin Mode: Centered Navigation Tabs Row */}
      {portalMode === 'admin' && (
        <div className="border-t border-zinc-850/90 bg-zinc-950/90 backdrop-blur-md px-4 sm:px-6">
          <div className="max-w-7xl mx-auto flex items-center justify-center overflow-x-auto py-1.5 gap-1 sm:gap-2 no-scrollbar">
            {adminNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-sans rounded-lg whitespace-nowrap transition-all ${
                    isActive
                      ? 'bg-zinc-800 text-emerald-300 border border-zinc-600 shadow-sm font-semibold'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/80 border border-transparent'
                  }`}
                >
                  <Icon className={`h-3.5 w-3.5 shrink-0 ${isActive ? 'text-emerald-400' : 'text-zinc-400'}`} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </header>
  );
};
