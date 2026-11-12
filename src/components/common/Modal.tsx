import React, { useEffect } from 'react';
import { X } from 'lucide-react';

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

  if (!isOpen) return null;

  const widthClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div
        className={`bg-white dark:bg-[#181B1F] rounded-[20px] border border-[#E3E6E8] dark:border-[#2A2F35] shadow-2xl w-full ${widthClasses[maxWidth]} overflow-hidden animate-in fade-in zoom-in-95 duration-150`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#E3E6E8] dark:border-[#2A2F35] flex items-center justify-between bg-[#F3F5F6]/70 dark:bg-[#1F2328]/70">
          <div>
            <h3 id="modal-title" className="text-sm font-bold text-[#14161A] dark:text-[#F2F4F5] uppercase tracking-wider">
              {title}
            </h3>
            {subtitle && (
              <p className="text-xs text-[#636B76] dark:text-[#8A929C] mt-0.5">{subtitle}</p>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="text-[#636B76] dark:text-[#8A929C] hover:text-[#14161A] dark:hover:text-white p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
};
