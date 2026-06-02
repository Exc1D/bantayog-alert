/**
 * Safe haptic feedback utility.
 * Wraps `navigator.vibrate` with feature-detection and reduced-motion awareness.
 * Falls back to no-op on unsupported platforms (desktop / iOS WebKit sans permission).
 * Patterns are tuned to matched UI intent: light for confirmation, medium for action,
 * heavy/error for attention.  Source: RevealSheet patterns + video-lesson haptics advice.
 */

import { useReducedMotion } from '../hooks/useReducedMotion'

const canVibrate = (): boolean =>
  typeof navigator !== 'undefined' && typeof (navigator as Navigator).vibrate === 'function'

/** Quick confirmation tick — after selecting a type, closing a panel */
export function hapticLight(): void {
  if (!canVibrate()) return
  navigator.vibrate?.(20)
}

/** Medium feedback — button presses, toggles, alerts opened */
export function hapticMedium(): void {
  if (!canVibrate()) return
  navigator.vibrate?.([30])
}

/** Heavy / error pattern — network failure, blocked action, max out */
export function hapticHeavy(): void {
  if (!canVibrate()) return
  navigator.vibrate?.([30, 60, 30])
}

/** Success pattern — report submitted, draft saved */
export function hapticSuccess(): void {
  if (!canVibrate()) return
  navigator.vibrate?.([15, 80, 25])
}

/** Queued pattern — a submit is being retried in background */
export function hapticQueued(): void {
  if (!canVibrate()) return
  navigator.vibrate?.([30])
}

/** Hook wrapper that checks `prefers-reduced-motion` before firing. */
export function useHaptics() {
  const reduced = useReducedMotion()
  if (reduced) {
    return {
      light: () => void 0,
      medium: () => void 0,
      heavy: () => void 0,
      success: () => void 0,
      queued: () => void 0,
    }
  }
  return {
    light: hapticLight,
    medium: hapticMedium,
    heavy: hapticHeavy,
    success: hapticSuccess,
    queued: hapticQueued,
  }
}
