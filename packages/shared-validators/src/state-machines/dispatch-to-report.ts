/**
 * Mirror trigger helper: maps dispatch state to report state.
 *
 * Used by dispatch-mirror-to-report trigger to synchronize responder
 * progression back to the parent report document.
 *
 * NOTE: Returns `null` for terminal/failure states (pending, declined,
 * timed_out, cancelled, superseded) because those states are handled
 * by the cancelDispatch callable or require explicit admin action.
 */

import type { DispatchStatus } from '../dispatches.js'
import type { ReportStatus } from './report-states.js'

export function dispatchToReportState(dispatchStatus: DispatchStatus): ReportStatus | null {
  switch (dispatchStatus) {
    case 'accepted':
    case 'acknowledged':
      return 'acknowledged'
    case 'en_route':
      return 'en_route'
    case 'on_scene':
      return 'on_scene'
    case 'resolved':
      return 'resolved'
    default:
      return null
  }
}
