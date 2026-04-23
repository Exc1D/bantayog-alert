import type { DispatchStatus } from '@bantayog/shared-types'
import type { Timestamp } from 'firebase/firestore'

export type ResponderUiState = 'pending' | 'heading_to_scene' | 'on_scene' | 'resolved' | 'terminal'
export type TerminalSurface = 'cancelled' | 'race_loss' | null

export interface QueueDispatchRow {
  dispatchId: string
  reportId: string
  status: DispatchStatus
  dispatchedAt: number
  uiStatus?: ResponderUiState
  acknowledgementDeadlineAt?: Timestamp
}

export function getResponderUiState(status: DispatchStatus): ResponderUiState {
  if (status === 'pending') return 'pending'
  if (status === 'accepted' || status === 'acknowledged' || status === 'en_route') {
    return 'heading_to_scene'
  }
  if (status === 'on_scene') return 'on_scene'
  if (status === 'resolved') return 'resolved'
  return 'terminal'
}

export function groupDispatchRows(rows: QueueDispatchRow[]) {
  return {
    pending: rows.filter((row) => row.status === 'pending'),
    active: rows.filter((row) =>
      ['accepted', 'acknowledged', 'en_route', 'on_scene'].includes(row.status),
    ),
  }
}

export function getSingleActiveDispatchId(rows: Array<{ dispatchId: string; status: DispatchStatus }>) {
  const active = rows.filter((row) =>
    ['accepted', 'acknowledged', 'en_route', 'on_scene'].includes(row.status),
  )
  return active.length === 1 ? active[0]!.dispatchId : null
}

export function getTerminalSurface(statusOrCode: string): TerminalSurface {
  if (statusOrCode === 'cancelled' || statusOrCode === 'timed_out') return 'cancelled'
  if (statusOrCode === 'already-exists') return 'race_loss'
  return null
}
