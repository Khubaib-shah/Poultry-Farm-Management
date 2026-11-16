import React, { useEffect, useRef, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import {
  APPLE_BUBBLE_SPRING,
  APPLE_EASE_OUT,
  APPLE_TAP_SPRING,
} from '../../utils/appleBubbleMotion.ts';

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
        scale: APPLE_TAP_SPRING,
      }}
      className={`relative h-[32px] overflow-hidden inline-flex items-center justify-center rounded-full text-[11px] font-bold shrink-0 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap select-none transition-colors duration-200 ${
        label ? 'px-3.5' : ''
      } ${
        confirming
          ? 'text-white shadow-[0_1px_2px_rgba(225,29,72,0.14)] dark:shadow-none'
          : label
          ? 'border border-rose-200 dark:border-rose-500/30 bg-rose-50/60 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/15 shadow-none'
          : 'bg-[#EDEEEF] dark:bg-[#22262C] border border-[#E3E6E8]/90 dark:border-[#323842] text-[#636B76] dark:text-[#98A0AB] hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/15 hover:border-rose-200 dark:hover:border-rose-500/30 shadow-none'
      } ${className}`}
    >
      {/* Crisp Rose Capsule */}
      <AnimatePresence initial={false}>
        {confirming && (
          <motion.span
            key="confirm-pill"
            initial={{ opacity: 0, scale: 0.72 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.72 }}
            transition={APPLE_BUBBLE_SPRING}
            className="absolute inset-0 rounded-full bg-rose-600 dark:bg-rose-500 z-0"
          />
        )}
      </AnimatePresence>

      {/* Subtle Bubble Pulse Ripple on Tap */}
      <AnimatePresence>
        {rippleKey > 0 && (
          <motion.span
            key={`ripple-${rippleKey}`}
            initial={{ opacity: 0.3, scale: 0.6 }}
            animate={{ opacity: 0, scale: 1.45 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.36, ease: APPLE_EASE_OUT }}
            className={`pointer-events-none absolute inset-0 rounded-full z-0 ${
              confirming ? 'bg-white/30' : 'bg-rose-400/25'
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

