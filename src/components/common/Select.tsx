import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, Search } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';

export interface SelectOption {
  value: string;
  label: string;
  sublabel?: string;
}

interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  searchable?: boolean;
  disabled?: boolean;
  size?: 'sm' | 'md';
  placement?: 'auto' | 'down' | 'up';
  className?: string;
  ariaLabel?: string;
}

export const Select: React.FC<SelectProps> = ({
  value,
  onChange,
  options,
  placeholder = 'Choose an option',
  searchable = false,
  disabled = false,
  size = 'md',
  placement = 'auto',
  className = '',
  ariaLabel,
}) => {
  const [open, setOpen] = useState(false);
  const [openUpward, setOpenUpward] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.value === value);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKey);
    };
  }, []);

  const filtered = searchable && query.trim()
    ? options.filter(
        (o) =>
          o.label.toLowerCase().includes(query.toLowerCase()) ||
          (o.sublabel && o.sublabel.toLowerCase().includes(query.toLowerCase()))
      )
    : options;

  const triggerHeight = size === 'sm' ? 'min-h-[38px] px-3.5 py-1.5 text-xs' : 'min-h-[42px] px-4 py-2 text-xs';

  const handleToggle = () => {
    if (disabled) return;
    if (!open) {
      if (placement === 'up') {
        setOpenUpward(true);
      } else if (placement === 'down') {
        setOpenUpward(false);
      } else if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const spaceBelow = window.innerHeight - rect.bottom;
        const spaceAbove = rect.top;
        setOpenUpward(spaceBelow < 250 && spaceAbove > spaceBelow);
      }
      setQuery('');
    }
    setOpen((prev) => !prev);
  };

  return (
    <div ref={containerRef} className={`relative ${open ? 'z-50' : ''} ${className}`}>
      <button
        type="button"
        disabled={disabled}
        aria-label={ariaLabel || placeholder}
        aria-expanded={open}
        onClick={handleToggle}
        className={`w-full ${triggerHeight} rounded-[14px] border border-[#E3E6E8] dark:border-[#2A2F35] bg-[#F3F5F6]/70 dark:bg-[#1F2328]/80 text-left flex items-center justify-between gap-2 text-[#14161A] dark:text-[#F2F4F5] font-medium hover:border-[#D7DBDF] dark:hover:border-[#373E47] focus:outline-none focus:ring-2 focus:ring-[#D4F56B] transition disabled:opacity-50 cursor-pointer`}
      >
        <span className="truncate min-w-0">
          {selectedOption ? (
            <span className="flex items-center gap-1.5 min-w-0">
              <span className="truncate font-semibold whitespace-nowrap">{selectedOption.label}</span>
              {selectedOption.sublabel && (
                <span className="text-[11px] text-[#636B76] dark:text-[#8A929C] truncate hidden sm:inline">
                  ({selectedOption.sublabel})
                </span>
              )}
            </span>
          ) : (
            <span className="text-[#636B76] dark:text-[#8A929C] whitespace-nowrap">{placeholder}</span>
          )}
        </span>
        <ChevronDown
          className={`w-4 h-4 text-[#636B76] dark:text-[#8A929C] shrink-0 transition-transform duration-150 ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: openUpward ? -4 : 4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: openUpward ? -4 : 4, scale: 0.98 }}
            transition={{ duration: 0.14 }}
            className={`absolute left-0 right-0 z-50 rounded-[16px] bg-white dark:bg-[#181B1F] border border-[#E3E6E8] dark:border-[#2A2F35] shadow-[0_10px_30px_rgba(20,22,26,0.14)] dark:shadow-[0_10px_30px_rgba(0,0,0,0.45)] overflow-hidden min-w-[200px] ${
              openUpward ? 'bottom-full mb-1.5' : 'top-full mt-1.5'
            }`}
          >
            {searchable && (
              <div className="p-2 border-b border-[#E3E6E8] dark:border-[#2A2F35]">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-[#636B76] dark:text-[#8A929C]" />
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Type to search..."
                    autoFocus
                    className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg bg-[#F3F5F6] dark:bg-[#1F2328] text-[#14161A] dark:text-[#F2F4F5] focus:outline-none focus:ring-1 focus:ring-[#D4F56B]"
                  />
                </div>
              </div>
            )}

            <div className="max-h-56 overflow-y-auto p-1.5 space-y-0.5">
              {filtered.length === 0 ? (
                <div className="py-4 text-center text-xs text-[#636B76] dark:text-[#8A929C]">
                  No options found
                </div>
              ) : (
                filtered.map((opt) => {
                  const isSelected = opt.value === value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => {
                        onChange(opt.value);
                        setOpen(false);
                      }}
                      className={`w-full px-3 py-2.5 rounded-[10px] text-left text-xs flex items-center justify-between gap-2 transition cursor-pointer ${
                        isSelected
                          ? 'bg-[#D4F56B] text-[#14161A] font-bold'
                          : 'text-[#14161A] dark:text-[#F2F4F5] hover:bg-[#F3F5F6] dark:hover:bg-[#1F2328]'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="truncate">{opt.label}</div>
                        {opt.sublabel && (
                          <div
                            className={`text-[11px] truncate ${
                              isSelected
                                ? 'text-[#14161A]/75'
                                : 'text-[#636B76] dark:text-[#8A929C]'
                            }`}
                          >
                            {opt.sublabel}
                          </div>
                        )}
                      </div>
                      {isSelected && <Check className="w-3.5 h-3.5 shrink-0" />}
                    </button>
                  );
                })
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
