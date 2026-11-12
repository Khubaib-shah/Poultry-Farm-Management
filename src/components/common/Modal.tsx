import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  maxWidth = 'md',
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const widthClasses = {
    sm: 'sm:max-w-sm',
    md: 'sm:max-w-md',
    lg: 'sm:max-w-lg',
    xl: 'sm:max-w-xl',
    '2xl': 'sm:max-w-2xl',
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16 }}
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center sm:p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 420, damping: 32 }}
            onClick={(e) => e.stopPropagation()}
            className={`bg-white dark:bg-[#181B1F] rounded-t-[24px] sm:rounded-[22px] border border-[#E3E6E8] dark:border-[#2A2F35] shadow-2xl w-full ${widthClasses[maxWidth]} max-h-[90vh] flex flex-col overflow-hidden`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
          >
            {/* Mobile drag handle indicator */}
            <div className="sm:hidden w-10 h-1 rounded-full bg-[#D7DBDF] dark:bg-[#373E47] mx-auto mt-2.5 mb-0.5 shrink-0" />

            {/* Sticky Header */}
            <div className="px-5 py-4 border-b border-[#E3E6E8] dark:border-[#2A2F35] flex items-center justify-between gap-3 bg-[#F3F5F6]/70 dark:bg-[#1F2328]/70 shrink-0">
              <div className="min-w-0">
                <h3
                  id="modal-title"
                  className="text-sm font-bold text-[#14161A] dark:text-[#F2F4F5] tracking-tight truncate"
                >
                  {title}
                </h3>
                {subtitle && (
                  <p className="text-xs text-[#636B76] dark:text-[#8A929C] mt-0.5 line-clamp-2">
                    {subtitle}
                  </p>
                )}
              </div>
              <button
                onClick={onClose}
                aria-label="Close dialog"
                className="min-w-[40px] min-h-[40px] flex items-center justify-center text-[#636B76] dark:text-[#8A929C] hover:text-[#14161A] dark:hover:text-white rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition shrink-0 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable Body */}
            <div className="p-5 sm:p-6 overflow-y-auto flex-1 text-[#14161A] dark:text-[#F2F4F5]">
              {children}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
