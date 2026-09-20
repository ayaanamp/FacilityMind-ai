import React, { useState } from 'react';
import {
  CheckCircle2,
  KeyRound,
  Lock,
  Shield,
  User,
  X,
  AlertCircle,
  Loader2,
  Eye,
  EyeOff,
} from 'lucide-react';
import { Button } from './ui/Button';
import { updateAdminCredentials } from '../services/api';
import { AdminUser } from '../types';

interface AdminPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  adminUser?: AdminUser | null;
  onAdminUpdated: (user: AdminUser) => void;
  onRequireRelogin?: () => void;
}

export const AdminPasswordModal: React.FC<AdminPasswordModalProps> = ({
  isOpen,
  onClose,
  adminUser,
  onAdminUpdated,
}) => {
  const [fullName, setFullName] = useState(adminUser?.full_name || 'Facility Administrator');
  const [username, setUsername] = useState(
    adminUser?.username || localStorage.getItem('fm_last_admin_username') || 'admin'
  );
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (!username.trim()) {
      setError('Admin Username cannot be empty.');
      return;
    }

    if (newPassword && newPassword.length < 3) {
      setError('Password must be at least 3 characters long.');
      return;
    }

    if (newPassword && newPassword !== confirmPassword) {
      setError('New Password and Confirm Password do not match.');
      return;
    }

    setSaving(true);
    try {
      const payload: any = {
        admin_name: fullName.trim(),
        admin_username: username.trim(),
      };

      if (newPassword.trim()) {
        payload.admin_password = newPassword.trim();
      }

      await updateAdminCredentials(payload);

      const updatedUser: AdminUser = {
        id: adminUser?.id || 1,
        username: username.trim(),
        full_name: fullName.trim(),
        email: adminUser?.email || '',
        phone: adminUser?.phone || '',
        role: adminUser?.role || 'Facility Administrator',
      };

      localStorage.setItem('fm_admin_user', JSON.stringify(updatedUser));
      localStorage.setItem('fm_last_admin_username', username.trim());
      if (newPassword.trim()) {
        localStorage.setItem('fm_saved_admin_password', newPassword.trim());
      }

      onAdminUpdated(updatedUser);

      setSuccessMsg('Admin credentials updated successfully! New password is now active.');
      setNewPassword('');
      setConfirmPassword('');

      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err: any) {
      setError(err?.message || 'Failed to update credentials. Please check backend connection.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden font-sans text-xs">
        {/* Header */}
        <div className="bg-gradient-to-r from-zinc-900 via-zinc-950 to-zinc-900 px-6 py-5 border-b border-zinc-850 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <KeyRound className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white font-mono tracking-wide flex items-center gap-1.5">
                Admin Profile &amp; Password
              </h2>
              <p className="text-[11px] text-zinc-400 font-mono">
                Secure Administrator Command Center Access
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg border border-transparent hover:border-zinc-700 text-zinc-400 hover:text-white transition-all"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="p-3 rounded-lg bg-zinc-900/60 border border-zinc-800 text-[11px] text-zinc-400 space-y-1 font-mono">
            <span className="font-semibold text-emerald-400 flex items-center gap-1">
              <Shield className="h-3 w-3" />
              Cryptographic PBKDF2 Hashing
            </span>
            <p className="text-[10px] text-zinc-500">
              Updating your credentials ensures that only you can authenticate into the Admin Command Center.
            </p>
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-red-950/40 border border-red-800/80 text-red-300 flex items-center gap-2 font-mono text-xs">
              <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 rounded-lg bg-emerald-950/40 border border-emerald-800/80 text-emerald-300 flex items-center gap-2 font-mono text-xs">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
              <span>{successMsg}</span>
            </div>
          )}

          <div className="space-y-1">
            <label className="text-zinc-300 font-semibold flex items-center gap-1.5 font-mono">
              <User className="h-3.5 w-3.5 text-zinc-400" />
              Admin Display Name
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g. Ayaan (Facility Director)"
              className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2.5 text-white font-mono placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="space-y-1">
            <label className="text-zinc-300 font-semibold flex items-center gap-1.5 font-mono">
              <Lock className="h-3.5 w-3.5 text-emerald-400" />
              Admin Login Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. admin or custom username"
              className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2.5 text-white font-mono placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="space-y-1 pt-1">
            <div className="flex items-center justify-between">
              <label className="text-zinc-300 font-semibold flex items-center gap-1.5 font-mono">
                <KeyRound className="h-3.5 w-3.5 text-emerald-400" />
                New Admin Password
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
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password (leave blank to keep current)"
                className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2.5 text-white font-mono placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500 pr-10"
              />
            </div>
          </div>

          {newPassword && (
            <div className="space-y-1 animate-in fade-in duration-150">
              <label className="text-zinc-300 font-semibold flex items-center gap-1.5 font-mono">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                Confirm New Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter new password"
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2.5 text-white font-mono placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500 pr-10"
                />
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-850 font-mono">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="border-zinc-800 hover:bg-zinc-900 text-zinc-400 hover:text-white text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={saving}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5"
            >
              {saving ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Updating...
                </>
              ) : (
                <>
                  <Shield className="h-3.5 w-3.5" />
                  Save Admin Credentials
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
