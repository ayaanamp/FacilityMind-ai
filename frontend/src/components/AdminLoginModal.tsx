import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckSquare,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  Shield,
  Square,
  User,
  X,
} from 'lucide-react';
import { Button } from './ui/Button';
import { loginAdmin } from '../services/api';
import { AdminUser } from '../types';

interface AdminLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (user: AdminUser) => void;
  orgName?: string;
}

export const AdminLoginModal: React.FC<AdminLoginModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  orgName = 'Facility Operations',
}) => {
  const [username, setUsername] = useState(() => {
    return localStorage.getItem('fm_last_admin_username') || 'admin';
  });
  const [password, setPassword] = useState(() => {
    return localStorage.getItem('fm_saved_admin_password') || '';
  });
  const [rememberCredentials, setRememberCredentials] = useState(() => {
    return localStorage.getItem('fm_remember_admin') !== 'false';
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync state whenever modal opens
  useEffect(() => {
    if (isOpen) {
      const savedUser = localStorage.getItem('fm_last_admin_username') || 'admin';
      const savedPass = localStorage.getItem('fm_saved_admin_password') || '';
      setUsername(savedUser);
      setPassword(savedPass);
      setError(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUsername = username.trim();
    if (!cleanUsername || !password) {
      setError('Please enter both username and password.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await loginAdmin({
        username: cleanUsername,
        password: password,
      });

      // Persist remembered credentials
      localStorage.setItem('fm_last_admin_username', cleanUsername);
      if (rememberCredentials) {
        localStorage.setItem('fm_remember_admin', 'true');
        localStorage.setItem('fm_saved_admin_password', password);
      } else {
        localStorage.setItem('fm_remember_admin', 'false');
        localStorage.removeItem('fm_saved_admin_password');
      }

      onSuccess(res.user);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Authentication failed. Please verify your admin username and password.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    // Preserve typed username in localStorage so it is never lost on cancel/retry
    if (username.trim()) {
      localStorage.setItem('fm_last_admin_username', username.trim());
    }
    if (rememberCredentials && password) {
      localStorage.setItem('fm_saved_admin_password', password);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden font-mono text-xs">
        {/* Header */}
        <div className="bg-gradient-to-r from-zinc-900 via-zinc-950 to-zinc-900 px-6 py-5 border-b border-zinc-850 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-wide flex items-center gap-1.5">
                Admin Authentication
              </h2>
              <p className="text-[11px] text-zinc-400">
                {orgName} Command Center Access
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 rounded-lg border border-transparent hover:border-zinc-700 text-zinc-400 hover:text-white transition-all"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="p-3 rounded-lg bg-zinc-900/80 border border-zinc-800 text-[11px] text-zinc-400 space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-emerald-400 flex items-center gap-1">
                <Lock className="h-3 w-3" />
                Persistent Admin Credentials
              </span>
              <span className="text-[10px] text-zinc-500">Auto-Remembered</span>
            </div>
            <p className="text-[10px] text-zinc-400 leading-relaxed">
              Use your configured administrator username and password (or default{' '}
              <strong className="text-emerald-300">admin / admin</strong> on initial setup).
            </p>
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-red-950/40 border border-red-800/80 text-red-300 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
              <span className="leading-snug">{error}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-zinc-300 font-semibold flex items-center gap-1.5">
              <User className="h-3.5 w-3.5 text-emerald-400" />
              Admin Username
            </label>
            <input
              type="text"
              required
              autoFocus
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. admin"
              className="w-full rounded-lg border border-zinc-800 bg-zinc-900/80 px-3.5 py-2.5 text-white placeholder-zinc-500 focus:border-emerald-500 focus:outline-none"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-zinc-300 font-semibold flex items-center gap-1.5">
                <KeyRound className="h-3.5 w-3.5 text-emerald-400" />
                Password
              </label>
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="text-[11px] text-zinc-400 hover:text-emerald-400 flex items-center gap-1 transition-colors"
              >
                {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                <span>{showPassword ? 'Hide' : 'Show'}</span>
              </button>
            </div>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your admin password"
                className="w-full rounded-lg border border-zinc-800 bg-zinc-900/80 px-3.5 py-2.5 text-white placeholder-zinc-500 focus:border-emerald-500 focus:outline-none pr-10"
              />
            </div>
          </div>

          {/* Remember Credentials Checkbox */}
          <div
            onClick={() => setRememberCredentials(!rememberCredentials)}
            className="flex items-center gap-2 cursor-pointer select-none text-zinc-400 hover:text-zinc-200 pt-1"
          >
            {rememberCredentials ? (
              <CheckSquare className="h-4 w-4 text-emerald-400 shrink-0" />
            ) : (
              <Square className="h-4 w-4 text-zinc-600 shrink-0" />
            )}
            <span className="text-[11px]">Remember login credentials on this browser</span>
          </div>

          <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-zinc-850">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleClose}
              disabled={loading}
              className="border-zinc-800 hover:border-zinc-700 text-zinc-400"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={loading}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
            >
              {loading ? 'Authenticating...' : 'Sign In as Admin'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
