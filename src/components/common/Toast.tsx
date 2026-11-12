import React from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';

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
  return (
    <div className="fixed bottom-24 xl:bottom-5 right-3 left-3 sm:left-auto sm:right-5 z-50 flex flex-col gap-2 sm:max-w-sm pointer-events-none">
      <AnimatePresence>
        {toasts.map((t) => {
          const isSuccess = t.type === 'success';
          const isError = t.type === 'error';

          return (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 12, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.96 }}
              transition={{ duration: 0.16 }}
              className={`pointer-events-auto p-3.5 rounded-[16px] border text-xs shadow-lg flex items-start gap-2.5 backdrop-blur-md ${
                isSuccess
                  ? 'bg-white/95 dark:bg-[#181B1F]/95 border-[#92E2B3] text-[#14161A] dark:text-[#F2F4F5]'
                  : isError
                  ? 'bg-rose-50/95 dark:bg-rose-950/95 border-rose-300 dark:border-rose-700 text-rose-900 dark:text-rose-100'
                  : 'bg-white/95 dark:bg-[#181B1F]/95 border-[#E3E6E8] dark:border-[#2A2F35] text-[#14161A] dark:text-[#F2F4F5]'
              }`}
            >
              {isSuccess && <CheckCircle2 className="w-4 h-4 text-[#2FB67C] shrink-0 mt-0.5" />}
              {isError && <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />}
              {!isSuccess && !isError && <Info className="w-4 h-4 text-[#636B76] shrink-0 mt-0.5" />}

              <div className="flex-1 font-medium leading-relaxed">{t.text}</div>

              <button
                onClick={() => onDismiss(t.id)}
                className="text-[#636B76] hover:text-[#14161A] dark:hover:text-white shrink-0 p-0.5 cursor-pointer"
                aria-label="Dismiss"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
};
