export const APPLE_BUBBLE_SPRING = {
  type: 'spring',
  stiffness: 460,
  damping: 24,
  mass: 0.72,
} as const;

export const APPLE_TAP_SPRING = {
  type: 'spring',
  stiffness: 480,
  damping: 20,
  mass: 0.68,
} as const;

export const APPLE_EASE_OUT = [0.22, 1, 0.36, 1] as const;

export interface BubbleInteractionConfig {
  disabled?: boolean;
  hoverScale?: number;
  tapScale?: number;
}

export function getAppleBubbleGestures({
  disabled = false,
  hoverScale = 1.03,
  tapScale = 0.89,
}: BubbleInteractionConfig = {}) {
  if (disabled) {
    return {
      whileHover: undefined,
      whileTap: undefined,
    };
  }
  return {
    whileHover: { scale: hoverScale },
    whileTap: { scale: tapScale },
  };
}
