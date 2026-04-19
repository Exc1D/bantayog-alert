/**
 * dispatch-mirror-to-report.ts
 *
 * Cloud Function v2 Firestore trigger (onDocumentWritten) that mirrors
 * dispatch state progression back to the parent report document.
 *
 * The pure helper `computeMirrorAction` is the decision function tested in
 * the unit tests. The trigger body (logger placeholder) is implemented
 * in Task 12.
 */

import { onDocumentWritten } from 'firebase-functions/v2/firestore'
import { logger } from 'firebase-functions'
import type { DispatchStatus, ReportStatus } from '@bantayog/shared-validators'
import { dispatchToReportState } from '@bantayog/shared-validators'

export type MirrorAction =
  | { action: 'skip'; reason: string }
  | { action: 'update'; to: ReportStatus }

/**
 * Pure decision function: given the before/after dispatch status and the
 * current report status, decide whether to skip or emit an update.
 *
 * Returns:
 * - `{ action: 'skip', reason: 'noop_same_status' }` when before === after
 * - `{ action: 'skip', reason: 'cancel_owned_by_callable' }` when after is 'cancelled'
 * - `{ action: 'skip', reason: 'no_mirror_for_<status>' }` when dispatchToReportState returns null
 * - `{ action: 'skip', reason: 'already_at_target' }` when mapped status === currentReportStatus
 * - `{ action: 'update', to: ReportStatus }` when a status write is needed
 */
export function computeMirrorAction(
  before: DispatchStatus | undefined,
  after: DispatchStatus | undefined,
  currentReportStatus: ReportStatus,
): MirrorAction {
  if (!after) return { action: 'skip', reason: 'deleted' }
  if (after === 'cancelled') return { action: 'skip', reason: 'cancel_owned_by_callable' }
  if (before === after) return { action: 'skip', reason: 'noop_same_status' }

  const mapped = dispatchToReportState(after)
  if (!mapped) return { action: 'skip', reason: `no_mirror_for_${after as string}` }
  if (mapped === currentReportStatus) return { action: 'skip', reason: 'already_at_target' }

  return { action: 'update', to: mapped }
}

// ---------------------------------------------------------------------------
// Cloud Function v2 trigger skeleton — body implemented in Task 12
// ---------------------------------------------------------------------------

export const dispatchMirrorToReport = onDocumentWritten(
  { document: 'dispatches/{dispatchId}', region: 'asia-southeast1', timeoutSeconds: 10 },
  // eslint-disable-next-line @typescript-eslint/require-await -- TODO(Task 12): replace with real async body
  async () => {
    // TODO(Task 12): implement trigger body
    logger.info('dispatchMirrorToReport skeleton')
  },
)
