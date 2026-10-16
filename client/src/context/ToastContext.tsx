import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
}

interface ToastContextValue {
  toasts: Toast[];
  showToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
  success: (title: string, message?: string) => void;
  error: (title: string, message?: string) => void;
  warning: (title: string, message?: string) => void;
  info: (title: string, message?: string) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    ({ type, title, message, duration = 4500 }: Omit<Toast, 'id'>) => {
      const id = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      const newToast: Toast = { id, type, title, message, duration };

      setToasts((prev) => [...prev, newToast]);

      if (duration > 0) {
        setTimeout(() => {
          removeToast(id);
        }, duration);
      }
    },
    [removeToast]
  );

  const success = useCallback(
    (title: string, message?: string) => showToast({ type: 'success', title, message }),
    [showToast]
  );
  const error = useCallback(
    (title: string, message?: string) => showToast({ type: 'error', title, message }),
    [showToast]
  );
  const warning = useCallback(
    (title: string, message?: string) => showToast({ type: 'warning', title, message }),
    [showToast]
  );
  const info = useCallback(
    (title: string, message?: string) => showToast({ type: 'info', title, message }),
    [showToast]
  );

  return (
    <ToastContext.Provider
      value={{ toasts, showToast, removeToast, success, error, warning, info }}
    >
      {children}
      {/* Toast Viewport */}
      <div
        aria-live="assertive"
        className="fixed bottom-4 right-4 z-50 flex flex-col gap-2.5 max-w-md w-full pointer-events-none px-4 sm:px-0"
      >
        {toasts.map((toast) => {
          const icons = {
            success: <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />,
            error: <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />,
            warning: <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />,
            info: <Info className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />,
          };

          const borders = {
            success: 'border-emerald-500/30 bg-[#070d18]/95 shadow-emerald-500/10',
            error: 'border-rose-500/30 bg-[#070d18]/95 shadow-rose-500/10',
            warning: 'border-amber-500/30 bg-[#070d18]/95 shadow-amber-500/10',
            info: 'border-blue-500/30 bg-[#070d18]/95 shadow-blue-500/10',
          };

          return (
            <div
              key={toast.id}
              role="alert"
              className={`pointer-events-auto flex items-start gap-3 p-4 rounded-xl border shadow-xl backdrop-blur-md transition-all duration-200 animate-in fade-in slide-in-from-bottom-2 ${borders[toast.type]}`}
            >
              {icons[toast.type]}
              <div className="flex-1 min-w-0 pr-2">
                <h4 className="text-sm font-semibold text-slate-100 leading-snug">{toast.title}</h4>
                {toast.message && (
                  <p className="text-xs text-slate-400 mt-0.5 leading-relaxed break-words">
                    {toast.message}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => removeToast(toast.id)}
                aria-label="Dismiss notification"
                className="text-slate-400 hover:text-slate-200 p-1 rounded-md transition hover:bg-slate-800/60 shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = (): ToastContextValue => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

