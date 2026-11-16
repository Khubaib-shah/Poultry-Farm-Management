import React, { useState } from 'react';
import { AnimatePresence, motion, type HTMLMotionProps } from 'motion/react';
import {
  APPLE_EASE_OUT,
  APPLE_TAP_SPRING,
  getAppleBubbleGestures,
} from '../../utils/appleBubbleMotion.ts';

export interface AppleBubbleButtonProps
  extends Omit<HTMLMotionProps<'button'>, 'ref' | 'children'> {
  children?: React.ReactNode;
  hoverScale?: number;
  tapScale?: number;
  ripple?: boolean;
  rippleClassName?: string;
}

export const AppleBubbleButton = React.forwardRef<HTMLButtonElement, AppleBubbleButtonProps>(
  (
    {
      children,
      className = '',
      disabled = false,
      hoverScale = 1.03,
      tapScale = 0.89,
      ripple = true,
      rippleClassName = 'bg-black/[0.06] dark:bg-white/[0.12]',
      onClick,
      type = 'button',
      transition,
      ...rest
    },
    ref
  ) => {
    const [rippleKey, setRippleKey] = useState(0);
    const gestures = getAppleBubbleGestures({ disabled, hoverScale, tapScale });

    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      if (!disabled && ripple) {
        setRippleKey((k) => k + 1);
      }
      onClick?.(e);
    };

    return (
      <motion.button
        ref={ref}
        type={type}
        data-motion-button="true"
        disabled={disabled}
        whileHover={gestures.whileHover}
        whileTap={gestures.whileTap}
        transition={transition ?? { scale: APPLE_TAP_SPRING }}
        onClick={handleClick}
        className={`relative ${className}`}
        {...rest}
      >
        {ripple && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 rounded-[inherit] overflow-hidden z-0"
          >
            <AnimatePresence>
              {rippleKey > 0 && (
                <motion.span
                  key={`bubble-ripple-${rippleKey}`}
                  initial={{ opacity: 0.4, scale: 0.6 }}
                  animate={{ opacity: 0, scale: 1.45 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.36, ease: APPLE_EASE_OUT }}
                  className={`absolute inset-0 rounded-[inherit] ${rippleClassName}`}
                />
              )}
            </AnimatePresence>
          </span>
        )}
        {children}
      </motion.button>
    );
  }
);

AppleBubbleButton.displayName = 'AppleBubbleButton';
