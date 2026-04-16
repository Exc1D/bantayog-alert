import type { DispatchActorRole, DispatchStatus } from './enums'
import type { FirestoreTimestamp } from './auth'

/** §5.2 — dispatches/{dispatchId} */
export interface Dispatch {
  reportId: string
  responderId: string
  municipalityId: string
  agencyId: string
  dispatchedBy: string
  dispatchedByRole: DispatchActorRole
  dispatchedAt: FirestoreTimestamp
  status: DispatchStatus
  statusUpdatedAt: FirestoreTimestamp
  acknowledgementDeadlineAt: FirestoreTimestamp
  acknowledgedAt?: FirestoreTimestamp
  inProgressAt?: FirestoreTimestamp
  resolvedAt?: FirestoreTimestamp
  cancelledAt?: FirestoreTimestamp
  cancelledBy?: string
  cancelReason?: string
  timeoutReason?: string
  declineReason?: string
  resolutionSummary?: string
  proofPhotoUrl?: string
  requestedByMunicipalAdmin?: boolean
  requestId?: string
  idempotencyKey: string
  schemaVersion: number
}
