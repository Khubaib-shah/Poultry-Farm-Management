import React from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  text: string;
}

interface ToastProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<ToastProps> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col space-y-2 max-w-sm w-full">
      {toasts.map((t) => {
        const isSuccess = t.type === 'success';
        const isError = t.type === 'error';

        return (
          <div
            key={t.id}
            className={`p-3 rounded-md border text-xs shadow-md flex items-start space-x-2.5 transition-all animate-in slide-in-from-bottom-2 ${
              isSuccess
                ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                : isError
                ? 'bg-rose-50 border-rose-300 text-rose-900'
                : 'bg-slate-50 border-slate-300 text-slate-900'
            }`}
          >
            {isSuccess && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />}
            {isError && <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />}
            {!isSuccess && !isError && <Info className="w-4 h-4 text-slate-600 shrink-0 mt-0.5" />}

            <div className="flex-1 font-medium">{t.text}</div>

            <button
              onClick={() => onDismiss(t.id)}
              className="text-slate-400 hover:text-slate-700 shrink-0"
              aria-label="Dismiss"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
