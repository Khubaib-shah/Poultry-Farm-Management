import React, { useEffect, useRef, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

interface ConfirmDeleteButtonProps {
  onConfirm: () => Promise<void> | void;
  ariaLabel: string;
  confirmLabel?: string;
  title?: string;
  disabled?: boolean;
  label?: string;
  compactSlot?: boolean;
  className?: string;
}

const APPLE_BUBBLE_SPRING = {
  type: 'spring',
  stiffness: 460,
  damping: 24,
  mass: 0.72,
} as const;

const APPLE_EASE_OUT = [0.22, 1, 0.36, 1] as const;

export const ConfirmDeleteButton: React.FC<ConfirmDeleteButtonProps> = ({
  onConfirm,
  ariaLabel,
  confirmLabel = 'Confirm?',
  title,
  disabled = false,
  label,
  compactSlot = false,
  className = '',
}) => {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [rippleKey, setRippleKey] = useState(0);
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!confirming) return;
    const handleOutsideClick = (event: PointerEvent) => {
      if (buttonRef.current && !buttonRef.current.contains(event.target as Node)) {
        setConfirming(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setConfirming(false);
      }
    };
    document.addEventListener('pointerdown', handleOutsideClick);
    document.addEventListener('keydown', handleKeyDown);
    const timer = window.setTimeout(() => setConfirming(false), 15000);
    return () => {
      document.removeEventListener('pointerdown', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
      window.clearTimeout(timer);
    };
  }, [confirming]);

  const handleClick = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (disabled || busy) return;
    setRippleKey((k) => k + 1);
    if (!confirming) {
      setConfirming(true);
      return;
    }
    setConfirming(false);
    setBusy(true);
    try {
      await onConfirm();
    } catch {
      // store handles toast & rollback
    } finally {
      setBusy(false);
    }
  };

  const buttonEl = (
    <motion.button
      ref={buttonRef}
      type="button"
      data-motion-button="true"
      disabled={disabled || busy}
      aria-label={confirming ? `${confirmLabel} (${ariaLabel})` : ariaLabel}
      title={title || ariaLabel}
      onClick={handleClick}
      whileHover={disabled || busy ? undefined : { scale: 1.05 }}
      whileTap={disabled || busy ? undefined : { scale: 0.86 }}
      animate={
        label
          ? { scale: 1 }
          : {
              width: confirming ? 80 : 32,
              scale: 1,
            }
      }
      transition={{
        width: APPLE_BUBBLE_SPRING,
        scale: { type: 'spring', stiffness: 480, damping: 20, mass: 0.68 },
      }}
      className={`relative h-[32px] overflow-hidden inline-flex items-center justify-center rounded-full text-[11px] font-bold shrink-0 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap select-none transition-colors duration-200 ${
        label ? 'px-3.5' : ''
      } ${
        confirming
          ? 'text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_4px_14px_rgba(225,29,72,0.34)]'
          : label
          ? 'border border-rose-200 dark:border-rose-500/30 bg-rose-50/50 dark:bg-rose-500/5 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/15'
          : 'bg-[#F3F5F6] dark:bg-[#22262C] border border-[#E3E6E8]/90 dark:border-[#323842] text-[#636B76] dark:text-[#98A0AB] hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/15 hover:border-rose-200 dark:hover:border-rose-500/30 shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_1px_2px_rgba(20,22,26,0.05)] dark:shadow-none'
      } ${className}`}
    >
      {/* Apple Liquid Glass Rose Capsule */}
      <AnimatePresence initial={false}>
        {confirming && (
          <motion.span
            key="confirm-pill"
            initial={{ opacity: 0, scale: 0.72 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.72 }}
            transition={APPLE_BUBBLE_SPRING}
            className="absolute inset-0 rounded-full bg-gradient-to-b from-rose-500 to-rose-600 ring-1 ring-inset ring-white/30 z-0"
          />
        )}
      </AnimatePresence>

      {/* Bubble Pulse Ripple on Tap */}
      <AnimatePresence>
        {rippleKey > 0 && (
          <motion.span
            key={`ripple-${rippleKey}`}
            initial={{ opacity: 0.45, scale: 0.55 }}
            animate={{ opacity: 0, scale: 1.55 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.38, ease: APPLE_EASE_OUT }}
            className={`pointer-events-none absolute inset-0 rounded-full z-0 ${
              confirming ? 'bg-white/40' : 'bg-rose-400/30'
            }`}
          />
        )}
      </AnimatePresence>

      {/* Continuous Crossfade Label vs Icon (never detaches layout or flickers) */}
      {label ? (
        <span className="relative z-10 inline-flex items-center justify-center min-w-[68px]">
          <motion.span
            aria-hidden={confirming}
            initial={false}
            animate={{
              opacity: confirming ? 0 : 1,
              scale: confirming ? 0.65 : 1,
              filter: confirming ? 'blur(2px)' : 'blur(0px)',
            }}
            transition={{ duration: 0.18, ease: APPLE_EASE_OUT }}
            className="inline-flex items-center justify-center gap-1.5"
          >
            <Trash2 className="w-3.5 h-3.5 shrink-0" />
            <span>{label}</span>
          </motion.span>
          <motion.span
            aria-hidden={!confirming}
            initial={false}
            animate={{
              opacity: confirming ? 1 : 0,
              scale: confirming ? 1 : 0.65,
              filter: confirming ? 'blur(0px)' : 'blur(2px)',
            }}
            transition={APPLE_BUBBLE_SPRING}
            className="absolute inset-0 inline-flex items-center justify-center"
          >
            {confirmLabel}
          </motion.span>
        </span>
      ) : (
        <>
          <motion.span
            aria-hidden={confirming}
            initial={false}
            animate={{
              opacity: confirming ? 0 : 1,
              scale: confirming ? 0.55 : 1,
              rotate: confirming ? -18 : 0,
              filter: confirming ? 'blur(2px)' : 'blur(0px)',
            }}
            transition={{ duration: 0.18, ease: APPLE_EASE_OUT }}
            className="relative z-10 inline-flex items-center justify-center pointer-events-none"
          >
            <Trash2 className="w-3.5 h-3.5 shrink-0" />
          </motion.span>
          <motion.span
            aria-hidden={!confirming}
            initial={false}
            animate={{
              opacity: confirming ? 1 : 0,
              scale: confirming ? 1 : 0.65,
              filter: confirming ? 'blur(0px)' : 'blur(2px)',
            }}
            transition={APPLE_BUBBLE_SPRING}
            className="absolute inset-0 z-10 inline-flex items-center justify-center pointer-events-none"
          >
            {confirmLabel}
          </motion.span>
        </>
      )}
    </motion.button>
  );

  if (!label && !compactSlot) {
    return (
      <span className="inline-flex items-center justify-end w-[80px] h-[32px] shrink-0 align-middle">
        {buttonEl}
      </span>
    );
  }

  return buttonEl;
};

