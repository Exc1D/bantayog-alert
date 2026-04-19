/**
 * Mirror trigger helper: maps dispatch state → report state.
 *
 * Used by dispatch-mirror-to-report trigger to synchronize responder
 * progression back to the parent report document.
 *
 * NOTE: Returns `null` for `cancelled` because the cancelDispatch callable
 * owns the report write (reverts to verified with cancel reason).
 */

import type { DispatchStatus } from '../dispatches.js'

export function dispatchToReportState(dispatchStatus: DispatchStatus) {
  const mapping: Record<DispatchStatus, 'assigned' | 'en_route' | 'on_scene' | 'resolved' | null> =
    {
      // Initial dispatch states → assigned
      pending: 'assigned',
      accepted: 'assigned',
      acknowledged: 'assigned',

      // Responder progression mirrors report states
      en_route: 'en_route',
      on_scene: 'on_scene',

      // Terminal state
      resolved: 'resolved',

      // Rejected/failed states
      declined: 'assigned', // Declined dispatch doesn't change report status
      timed_out: 'assigned', // Timeout doesn't change report status (admin can re-dispatch)

      // Cancelled is handled by cancelDispatch callable
      cancelled: null,

      // Superseded means another responder was dispatched
      superseded: 'assigned',
    }

  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  return mapping[dispatchStatus]
}
