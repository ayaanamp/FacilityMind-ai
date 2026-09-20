import React from 'react';
import { Bell, Check, CheckCheck, Clock, X } from 'lucide-react';
import { NotificationItem } from '../types';
import { markAllNotificationsRead, markNotificationRead } from '../services/api';

interface NotificationsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: NotificationItem[];
  onRefresh: () => void;
  onSelectComplaint?: (complaintId: number) => void;
  userPhone?: string;
}

export const NotificationsDrawer: React.FC<NotificationsDrawerProps> = ({
  isOpen,
  onClose,
  notifications,
  onRefresh,
  onSelectComplaint,
  userPhone,
}) => {
  if (!isOpen) return null;

  const handleMarkRead = async (id: number) => {
    try {
      await markNotificationRead(id);
      onRefresh();
    } catch (err) {
      console.warn('Could not mark notification as read:', err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsRead(userPhone);
      onRefresh();
    } catch (err) {
      console.warn('Could not mark all notifications as read:', err);
    }
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/60 backdrop-blur-sm flex justify-end">
      <div className="w-full max-w-md bg-zinc-950 border-l border-zinc-800 shadow-2xl h-full flex flex-col animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="p-4 border-b border-zinc-850 flex items-center justify-between bg-zinc-900/60">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-950/80 border border-emerald-800 text-emerald-400">
              <Bell className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-white flex items-center gap-2">
                Live Notifications
                {unreadCount > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full bg-emerald-500 text-black text-[10px] font-extrabold font-mono">
                    {unreadCount} NEW
                  </span>
                )}
              </h3>
              <p className="text-[11px] text-zinc-400">Real-time complaint & dispatch updates</p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="p-1.5 text-xs text-zinc-400 hover:text-emerald-400 rounded-lg hover:bg-zinc-850 transition-colors flex items-center gap-1"
                title="Mark all as read"
              >
                <CheckCheck className="w-4 h-4" />
                <span className="text-[11px]">Mark All Read</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-850 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Notifications List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {notifications.length === 0 ? (
            <div className="py-16 text-center text-zinc-500 flex flex-col items-center gap-2">
              <Bell className="w-8 h-8 text-zinc-700" />
              <p className="text-xs">No notifications yet</p>
              <p className="text-[11px] text-zinc-600">Updates on complaints and dispatches will appear here in real-time.</p>
            </div>
          ) : (
            notifications.map((notif) => (
              <div
                key={notif.id}
                className={`p-3 rounded-xl border transition-all ${
                  notif.is_read
                    ? 'bg-zinc-900/40 border-zinc-850/60 text-zinc-400'
                    : 'bg-zinc-900 border-zinc-750 text-white shadow-md shadow-black/40'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-1.5">
                      {!notif.is_read && (
                        <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                      )}
                      <h4 className="text-xs font-bold text-zinc-100">{notif.title}</h4>
                    </div>
                    <p className="text-xs text-zinc-300 mt-1 leading-relaxed">{notif.message}</p>
                    <div className="flex items-center gap-3 mt-2 text-[10px] text-zinc-500 font-mono">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-zinc-600" />
                        {notif.created_at || 'Just now'}
                      </span>
                      {notif.complaint_id && (
                        <button
                          onClick={() => {
                            if (onSelectComplaint) {
                              onSelectComplaint(notif.complaint_id!);
                              onClose();
                            }
                          }}
                          className="text-emerald-400 hover:text-emerald-300 font-sans hover:underline flex items-center gap-1"
                        >
                          View Ticket #{notif.complaint_id} &rarr;
                        </button>
                      )}
                    </div>
                  </div>

                  {!notif.is_read && (
                    <button
                      onClick={() => handleMarkRead(notif.id)}
                      className="p-1 text-zinc-500 hover:text-emerald-400 rounded transition-colors"
                      title="Mark as read"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-zinc-850 bg-zinc-900/60 text-center text-[11px] text-zinc-500 font-mono">
          Live sync active &bull; Sub-50ms latency
        </div>
      </div>
    </div>
  );
};
