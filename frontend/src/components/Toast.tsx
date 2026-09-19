import React, { useEffect } from 'react';
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';

export interface ToastMessage {
  id: string;
  type: 'success' | 'info' | 'warning' | 'error';
  title: string;
  description?: string;
}

interface ToastContainerProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onDismiss }) => {
  return (
    <div className="fixed top-20 right-6 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
};


const ToastItem: React.FC<{ toast: ToastMessage; onDismiss: (id: string) => void }> = ({
  toast,
  onDismiss,
}) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss(toast.id);
    }, 4500);
    return () => clearTimeout(timer);
  }, [toast.id, onDismiss]);

  const getIcon = () => {
    switch (toast.type) {
      case 'success':
        return <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />;
      case 'error':
        return <AlertTriangle className="h-4 w-4 text-red-400 shrink-0" />;
      default:
        return <Info className="h-4 w-4 text-zinc-300 shrink-0" />;
    }
  };

  return (
    <div className="pointer-events-auto p-3.5 rounded-lg bg-zinc-950 border border-zinc-800 text-white shadow-2xl flex items-start justify-between gap-3 animate-in slide-in-from-bottom-2 duration-200">
      <div className="flex items-start gap-2.5">
        <div className="mt-0.5">{getIcon()}</div>
        <div>
          <h4 className="text-xs font-semibold text-white font-mono">{toast.title}</h4>
          {toast.description && (
            <p className="text-[11px] text-zinc-400 mt-0.5 leading-snug">{toast.description}</p>
          )}
        </div>
      </div>
      <button
        onClick={() => onDismiss(toast.id)}
        className="text-zinc-500 hover:text-white p-0.5 rounded transition-colors"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
};
