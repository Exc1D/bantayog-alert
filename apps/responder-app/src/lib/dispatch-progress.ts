export type DispatchProgressStatus =
  | 'pending'
  | 'accepted'
  | 'acknowledged'
  | 'heading_to_scene'
  | 'en_route'
  | 'on_scene'
  | 'resolved'

const PROGRESS_BY_STATUS: Record<DispatchProgressStatus, number> = {
  pending: 0,
  accepted: 20,
  acknowledged: 40,
  heading_to_scene: 60,
  en_route: 60,
  on_scene: 80,
  resolved: 100,
}

const STEP_LABELS = ['Accepted', 'Acknowledged', 'En Route', 'On Scene', 'Resolved'] as const

function normalizeStatus(status: string): DispatchProgressStatus {
  if (status === 'heading_to_scene') return 'heading_to_scene'
  if (status === 'accepted') return 'accepted'
  if (status === 'acknowledged') return 'acknowledged'
  if (status === 'en_route') return 'en_route'
  if (status === 'on_scene') return 'on_scene'
  if (status === 'resolved') return 'resolved'
  return 'pending'
}

export function getDispatchProgress(status: string): number {
  return PROGRESS_BY_STATUS[normalizeStatus(status)] ?? 0
}

export function getNextActionLabel(status: string): string {
  const normalized = normalizeStatus(status)
  if (normalized === 'acknowledged') return 'Mark En Route'
  if (normalized === 'heading_to_scene' || normalized === 'en_route') return 'Mark On Scene'
  if (normalized === 'on_scene') return 'Mark Resolved'
  if (normalized === 'resolved') return 'View Summary'
  return 'View Dispatch'
}

export function getStepValue(status: string): { value: number; text: string } {
  if (normalizeStatus(status) === 'pending') {
    return { value: 0, text: 'Pending acceptance' }
  }

  const progress = getDispatchProgress(status)
  const value = Math.max(0, Math.min(4, Math.round(progress / 20) - 1))
  return { value, text: STEP_LABELS[value] ?? 'Accepted' }
}

export function getRingStrokeOffset(percent: number, radius: number): number {
  if (!Number.isFinite(radius) || radius < 0) {
    throw new RangeError(`radius must be a finite non-negative number, got ${String(radius)}`)
  }
  if (!Number.isFinite(percent)) {
    throw new RangeError(`percent must be a finite number, got ${String(percent)}`)
  }
  const clampedPercent = Math.max(0, Math.min(100, percent))
  const circumference = 2 * Math.PI * radius
  return circumference - (clampedPercent / 100) * circumference
}

export function formatCountdownLabel(msRemaining: number): string {
  const safeMs = Number.isFinite(msRemaining) ? Math.max(0, msRemaining) : 0
  const totalSeconds = Math.floor(safeMs / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  const base = `Accept in ${String(minutes)} minutes ${String(seconds)} seconds`
  return safeMs < 60_000 ? `${base} urgent` : base
}
