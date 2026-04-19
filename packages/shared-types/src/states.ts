import type { DispatchStatus, ReportStatus } from './enums.js'

// Spec §5.3 — every valid report transition. Any transition not in this set
// is a rule violation and must be rejected server-side.
export const REPORT_TRANSITIONS: readonly [ReportStatus, ReportStatus][] = [
  ['draft_inbox', 'new'],
  ['draft_inbox', 'rejected'],
  ['new', 'awaiting_verify'],
  ['new', 'merged_as_duplicate'],
  ['awaiting_verify', 'verified'],
  ['awaiting_verify', 'merged_as_duplicate'],
  ['awaiting_verify', 'cancelled_false_report'],
  ['verified', 'assigned'],
  ['assigned', 'acknowledged'],
  ['acknowledged', 'en_route'],
  ['en_route', 'on_scene'],
  ['on_scene', 'resolved'],
  ['resolved', 'closed'],
  ['closed', 'reopened'],
  ['reopened', 'assigned'],
  // Any active state → cancelled (admin with reason)
  ['new', 'cancelled'],
  ['awaiting_verify', 'cancelled'],
  ['verified', 'cancelled'],
  ['assigned', 'cancelled'],
  ['acknowledged', 'cancelled'],
  ['en_route', 'cancelled'],
  ['on_scene', 'cancelled'],
] as const

// Spec §5.4 — dispatch transitions. Only responder-direct transitions are
// candidates for rule-layer enforcement; server-authoritative transitions
// live in callables.
export const DISPATCH_RESPONDER_DIRECT_TRANSITIONS: readonly [DispatchStatus, DispatchStatus][] = [
  ['accepted', 'acknowledged'],
  ['acknowledged', 'en_route'],
  ['en_route', 'on_scene'],
  ['on_scene', 'resolved'],
  ['pending', 'declined'],
] as const

export function isValidReportTransition(from: ReportStatus, to: ReportStatus): boolean {
  return REPORT_TRANSITIONS.some(([f, t]) => f === from && t === to)
}

export function isValidResponderDispatchTransition(
  from: DispatchStatus,
  to: DispatchStatus,
): boolean {
  return DISPATCH_RESPONDER_DIRECT_TRANSITIONS.some(([f, t]) => f === from && t === to)
}
