import { useCallback, useEffect, useRef, useState } from 'react';
import { createSubmitThrottle } from '../utils/submitThrottle.ts';

export interface UseThrottledSubmitOptions {
  /** Minimum time (ms) the submit button remains disabled after a successful submit starts. */
  minDisabledMs?: number;
  /** Cooldown (ms) after completion during which duplicate triggers are ignored. */
  cooldownMs?: number;
}

/**
 * React hook that prevents double-submission via:
 * 1. Synchronous ref lock (blocks same-tick double clicks before re-render).
 * 2. React `isSubmitting` boolean (immediately disables buttons in DOM).
 * 3. Trailing cooldown window so rapid double clicks never trigger twice.
 */
export function useThrottledSubmit(options: UseThrottledSubmitOptions = {}) {
  const minDisabledMs = options.minDisabledMs ?? 500;
  const cooldownMs = options.cooldownMs ?? 600;

  const [isSubmitting, setIsSubmitting] = useState(false);
  const throttleRef = useRef(createSubmitThrottle({ cooldownMs }));
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, []);

  const run = useCallback(
    async <T>(task: () => Promise<T>): Promise<T | undefined> => {
      if (throttleRef.current.isLocked()) {
        return undefined;
      }

      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }

      const startedAt = Date.now();
      setIsSubmitting(true);

      let succeeded = false;
      try {
        const res = await throttleRef.current.run(task);
        if (!res.executed) {
          return undefined;
        }
        succeeded = true;
        return res.value;
      } finally {
        if (mountedRef.current) {
          const elapsed = Date.now() - startedAt;
          const remainingDisable = succeeded ? Math.max(0, minDisabledMs - elapsed) : 0;

          if (remainingDisable === 0) {
            setIsSubmitting(false);
          } else {
            timerRef.current = setTimeout(() => {
              timerRef.current = null;
              if (mountedRef.current) {
                setIsSubmitting(false);
              }
            }, remainingDisable);
          }
        }
      }
    },
    [minDisabledMs]
  );

  const runOptimistic = useCallback(
    async <T>(execute: (commitOptimistic: () => void) => Promise<T>): Promise<boolean> => {
      try {
        await run(
          () =>
            new Promise<void>((resolve, reject) => {
              let committed = false;
              execute(() => {
                committed = true;
                resolve();
              }).catch((err) => {
                if (!committed) {
                  reject(err);
                }
              });
            })
        );
        return true;
      } catch {
        return false;
      }
    },
    [run]
  );

  const reset = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    throttleRef.current.reset();
    if (mountedRef.current) {
      setIsSubmitting(false);
    }
  }, []);

  return {
    isSubmitting,
    run,
    runOptimistic,
    reset,
  };
}
