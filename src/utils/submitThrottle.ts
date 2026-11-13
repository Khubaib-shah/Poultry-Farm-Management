export interface SubmitThrottleOptions {
  cooldownMs?: number;
  now?: () => number;
}

export type ThrottledRunResult<T> =
  | { executed: true; value: T }
  | { executed: false };

/**
 * Synchronous single-flight + trailing cooldown gate for form submissions and actions.
 * Guards against rapid double-clicks firing in the same event tick or immediately after completion.
 */
export function createSubmitThrottle(options: SubmitThrottleOptions = {}) {
  const cooldownMs = options.cooldownMs ?? 600;
  const now = options.now ?? (() => Date.now());

  let inFlight = false;
  let lastSuccessAt: number | null = null;

  const isInCooldown = (): boolean => {
    if (lastSuccessAt === null || cooldownMs <= 0) return false;
    return now() - lastSuccessAt < cooldownMs;
  };

  const isLocked = (): boolean => inFlight || isInCooldown();

  const run = async <T>(task: () => Promise<T>): Promise<ThrottledRunResult<T>> => {
    if (isLocked()) {
      return { executed: false };
    }

    inFlight = true;
    try {
      const value = await task();
      lastSuccessAt = now();
      return { executed: true, value };
    } finally {
      inFlight = false;
    }
  };

  const reset = () => {
    lastSuccessAt = null;
  };

  return {
    isLocked,
    run,
    reset,
  };
}

export interface StoreMutationGuardOptions {
  duplicateCooldownMs?: number;
  now?: () => number;
}

/**
 * Store-level defense-in-depth guard:
 * 1. Serializes/deduplicates concurrent in-flight calls for the same action name.
 * 2. Ignores identical (action + payload) submissions within `duplicateCooldownMs`.
 */
export function createStoreMutationGuard(options: StoreMutationGuardOptions = {}) {
  const duplicateCooldownMs = options.duplicateCooldownMs ?? 1500;
  const now = options.now ?? (() => Date.now());

  const inFlightByFingerprint = new Map<string, Promise<unknown>>();
  const activeCountByAction = new Map<string, number>();
  const recentByFingerprint = new Map<string, { at: number; value: unknown }>();

  const makeFingerprint = (action: string, payload: unknown): string => {
    try {
      return `${action}::${JSON.stringify(payload ?? null)}`;
    } catch {
      return `${action}::unserializable`;
    }
  };

  const pruneExpired = (currentTime: number) => {
    for (const [key, entry] of recentByFingerprint.entries()) {
      if (currentTime - entry.at >= duplicateCooldownMs) {
        recentByFingerprint.delete(key);
      }
    }
  };

  const run = <T>(
    action: string,
    payload: unknown,
    task: () => Promise<T>
  ): Promise<T> => {
    const fingerprint = makeFingerprint(action, payload);
    const existingInFlight = inFlightByFingerprint.get(fingerprint);
    if (existingInFlight) {
      return existingInFlight as Promise<T>;
    }

    const currentTime = now();
    pruneExpired(currentTime);

    const recent = recentByFingerprint.get(fingerprint);
    if (recent && currentTime - recent.at < duplicateCooldownMs) {
      return Promise.resolve(recent.value as T);
    }

    activeCountByAction.set(action, (activeCountByAction.get(action) ?? 0) + 1);

    const promise = (async () => {
      try {
        const result = await task();
        recentByFingerprint.set(fingerprint, { at: now(), value: result });
        return result;
      } finally {
        inFlightByFingerprint.delete(fingerprint);
        const nextCount = (activeCountByAction.get(action) ?? 1) - 1;
        if (nextCount <= 0) {
          activeCountByAction.delete(action);
        } else {
          activeCountByAction.set(action, nextCount);
        }
      }
    })();

    inFlightByFingerprint.set(fingerprint, promise);
    return promise;
  };

  const isInFlight = (action: string): boolean => (activeCountByAction.get(action) ?? 0) > 0;

  return {
    run,
    isInFlight,
  };
}
