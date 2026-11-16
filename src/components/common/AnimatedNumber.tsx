import React, { useEffect, useRef, useState } from 'react';
import { animate, motion, useMotionValue, useReducedMotion } from 'motion/react';
import { formatNumber } from '../../utils/formatters.ts';
import { APPLE_EASE_OUT } from '../../utils/appleBubbleMotion.ts';
import {
  getAnimatedNumberDuration,
  normalizeTargetNumber,
  roundAnimatedValue,
} from '../../utils/animatedNumberUtils.ts';

export const MOTION_COUNTER_EASE = [0.16, 1, 0.3, 1] as const;

export interface AnimatedNumberProps {
  value: number | string | null | undefined;
  formatter?: (val: number) => string;
  duration?: number;
  updateDuration?: number;
  delay?: number;
  decimals?: number;
  slideUp?: boolean;
  className?: string;
  testId?: string;
}

export const AnimatedNumber: React.FC<AnimatedNumberProps> = ({
  value,
  formatter = formatNumber,
  duration = 3.2,
  updateDuration = 1.2,
  delay = 0,
  decimals = 0,
  slideUp = true,
  className = '',
  testId,
}) => {
  const prefersReducedMotion = Boolean(useReducedMotion());
  const target = normalizeTargetNumber(value);

  const motionVal = useMotionValue(prefersReducedMotion ? target : 0);
  const [displayVal, setDisplayVal] = useState<number>(() =>
    prefersReducedMotion ? target : 0
  );
  const prevTargetRef = useRef<number>(prefersReducedMotion ? target : 0);

  useEffect(() => {
    if (prefersReducedMotion) {
      motionVal.set(target);
      setDisplayVal(target);
      prevTargetRef.current = target;
      return;
    }

    const fromVal = motionVal.get();
    if (fromVal === target && prevTargetRef.current === target) {
      setDisplayVal(target);
      return;
    }

    const animDuration = getAnimatedNumberDuration({
      fromValue: fromVal,
      toValue: target,
      initialDuration: duration,
      updateDuration,
      reducedMotion: prefersReducedMotion,
    });

    prevTargetRef.current = target;

    if (animDuration <= 0) {
      motionVal.set(target);
      setDisplayVal(target);
      return;
    }

    const controls = animate(motionVal, target, {
      duration: animDuration,
      delay,
      ease: MOTION_COUNTER_EASE,
      onUpdate: (latest) => {
        const rounded = roundAnimatedValue(latest, decimals);
        setDisplayVal((prev) => (prev === rounded ? prev : rounded));
      },
      onComplete: () => {
        setDisplayVal(target);
      },
    });

    return () => {
      controls.stop();
    };
  }, [target, duration, updateDuration, delay, decimals, prefersReducedMotion, motionVal]);

  const formatted = formatter(displayVal);

  if (!slideUp || prefersReducedMotion) {
    return (
      <span
        data-testid={testId}
        data-target-value={target}
        className={`inline-block tabular-nums ${className}`}
      >
        {formatted}
      </span>
    );
  }

  return (
    <motion.span
      data-testid={testId}
      data-target-value={target}
      initial={{ opacity: 0.35, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, delay, ease: APPLE_EASE_OUT }}
      className={`inline-block tabular-nums ${className}`}
    >
      {formatted}
    </motion.span>
  );
};
