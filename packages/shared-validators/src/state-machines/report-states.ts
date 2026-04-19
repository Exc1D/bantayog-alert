/**
 * State machine transition tables.
 *
 * These are the codegen source-of-truth for both TypeScript and Firestore rules
 * transition tables (see `scripts/build-rules.ts`). Any transition not in the
 * declared set must be rejected at the rules layer.
 */

// Re-export enums so consumers don't need a direct dependency on shared-types.
import type { ReportStatus, DispatchStatus } from '@bantayog/shared-types'
export type { ReportStatus, DispatchStatus }

// Spec §5.3 — all 15 report lifecycle states (includes `draft_inbox` pre-materialisation).
export const REPORT_STATES = [
  'draft_inbox',
  'new',
  'awaiting_verify',
  'verified',
  'assigned',
  'acknowledged',
  'en_route',
  'on_scene',
  'resolved',
  'closed',
  'reopened',
  'rejected',
  'cancelled',
  'cancelled_false_report',
  'merged_as_duplicate',
] as const

// Spec §5.3 — every valid report state transition.
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
  // Admin cancellations from any active state
  ['new', 'cancelled'],
  ['awaiting_verify', 'cancelled'],
  ['verified', 'cancelled'],
  ['assigned', 'cancelled'],
  ['acknowledged', 'cancelled'],
  ['en_route', 'cancelled'],
  ['on_scene', 'cancelled'],
] as const

// Spec §5.4 — dispatch lifecycle states.
// Re-exported from dispatch-states.ts to keep a single source of truth.
export { DISPATCH_STATES } from './dispatch-states.js'

// Spec §5.4 — dispatch transitions.
// Re-exported from dispatch-states.ts to keep a single source of truth.
export { DISPATCH_TRANSITIONS } from './dispatch-states.js'

export function isValidReportTransition(from: ReportStatus, to: ReportStatus): boolean {
  return (REPORT_TRANSITIONS as readonly [string, string][]).some(
    ([f, t]) => f === from && t === to,
  )
}
