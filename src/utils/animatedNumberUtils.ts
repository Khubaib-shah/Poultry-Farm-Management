export function normalizeTargetNumber(value: number | string | null | undefined): number {
  if (value === null || value === undefined || value === '') return 0;
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Object.is(parsed, -0) ? 0 : parsed;
}

export function roundAnimatedValue(raw: number, decimals: number = 0): number {
  if (!Number.isFinite(raw)) return 0;
  const safeDecimals = Math.max(0, Math.min(4, Math.floor(decimals)));
  const factor = Math.pow(10, safeDecimals);
  const rounded = Math.round(raw * factor) / factor;
  return Object.is(rounded, -0) ? 0 : rounded;
}

export function getAnimatedNumberDuration(params: {
  fromValue: number;
  toValue: number;
  initialDuration?: number;
  updateDuration?: number;
  reducedMotion?: boolean;
}): number {
  const {
    fromValue,
    toValue,
    initialDuration = 3.2,
    updateDuration = 1.2,
    reducedMotion = false,
  } = params;

  if (reducedMotion || fromValue === toValue) {
    return 0;
  }

  return fromValue === 0 ? initialDuration : updateDuration;
}
