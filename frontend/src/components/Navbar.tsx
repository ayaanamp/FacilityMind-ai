import React from 'react';
import {
  Activity,
  Compass,
  FileCheck2,
  FolderArchive,
  Layers,
  PlusCircle,
  Sparkles,
  Users,
  Zap,
} from 'lucide-react';
import { Button } from './ui/Button';

export type TabType =
  | 'dashboard'
  | 'new-complaint'
  | 'decision'
  | 'similar-cases'
  | 'history'
  | 'technicians'
  | 'health';

interface NavbarProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  onQuickDemo?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  onQuickDemo,
}) => {

  const navItems: Array<{ id: TabType; label: string; icon: React.ComponentType<{ className?: string }> }> = [
    { id: 'dashboard', label: 'Command Center', icon: Layers },
    { id: 'new-complaint', label: 'File Complaint', icon: PlusCircle },
    { id: 'decision', label: 'Decision Report', icon: FileCheck2 },
    { id: 'similar-cases', label: 'Evidence Explorer', icon: Compass },
    { id: 'history', label: 'Knowledge Base', icon: FolderArchive },
    { id: 'technicians', label: 'Staff & Payouts', icon: Users },
    { id: 'health', label: 'Diagnostics', icon: Activity },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-zinc-800/90 bg-zinc-950/95 backdrop-blur-xl shadow-lg shadow-black/50">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between min-h-[4rem] py-2 gap-2 sm:gap-4">
          {/* Brand Logo & Title (Modern Minimalist Aesthetic) */}
          <div
            className="flex items-center gap-2.5 sm:gap-3 cursor-pointer group select-none shrink-0"
            onClick={() => setActiveTab('dashboard')}
          >
            <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-xl bg-gradient-to-br from-emerald-500/20 via-zinc-900 to-sky-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 group-hover:border-emerald-400 group-hover:scale-105 transition-all shadow-md shadow-emerald-500/10 shrink-0">
              <Sparkles className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-1.5 sm:gap-2">
                <span className="font-extrabold text-base sm:text-lg tracking-wide text-white font-sans">
                  Facility<span className="text-emerald-400">Mind</span>
                </span>
                <span className="text-[10px] font-mono font-bold uppercase px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800/80">
                  AI
                </span>
                <span className="hidden 2xl:inline-block text-[10px] font-mono text-zinc-500 border-l border-zinc-800 pl-2">
                  v0.2 Enterprise
                </span>
              </div>
              <p className="text-[11px] text-zinc-400 font-sans tracking-normal hidden xl:block">
                Autonomous Campus Decision Intelligence
              </p>
            </div>
          </div>

          {/* Navigation Tabs (Spacious, Centered, No Line Wraps) */}
          <nav className="hidden lg:flex items-center gap-1 xl:gap-1.5 shrink-0">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`flex items-center gap-1.5 px-2.5 xl:px-3 py-1.5 text-xs font-sans font-medium rounded-lg whitespace-nowrap transition-all ${
                    isActive
                      ? 'bg-zinc-800 text-white border border-zinc-600 shadow-sm font-semibold text-emerald-300'
                      : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900/80 border border-transparent'
                  }`}
                >
                  <Icon className={`h-3.5 w-3.5 shrink-0 ${isActive ? 'text-emerald-400' : 'text-zinc-400'}`} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Right Action */}
          <div className="flex items-center gap-2 shrink-0">
            {onQuickDemo && (
              <Button
                variant="outline"
                size="sm"
                onClick={onQuickDemo}
                className="bg-emerald-950/40 hover:bg-emerald-900/50 text-emerald-300 hover:text-emerald-200 border border-emerald-600/50 font-sans text-xs flex items-center gap-1.5 whitespace-nowrap shadow-sm active:scale-95 transition-all px-3 py-1.5"
              >
                <Zap className="h-3.5 w-3.5 fill-current text-emerald-400 shrink-0" />
                <span className="font-semibold">1-Click Demo</span>
              </Button>
            )}
          </div>

        </div>

        {/* Mobile & Tablet Navigation Scrollbar */}
        <div className="flex lg:hidden overflow-x-auto py-2 gap-1.5 border-t border-zinc-850/80 no-scrollbar">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs whitespace-nowrap rounded-md font-sans transition-all ${
                  isActive
                    ? 'bg-zinc-800 text-white border border-zinc-700 font-semibold text-emerald-300'
                    : 'text-zinc-400 hover:text-zinc-200 bg-zinc-950 border border-zinc-850'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
};
