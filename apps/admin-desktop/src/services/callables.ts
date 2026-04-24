import { httpsCallable } from 'firebase/functions'
import { functions } from '../app/firebase'
import type { ReportStatus, DispatchStatus } from '@bantayog/shared-types'

type IdempotencyKey = string

export const callables = {
  verifyReport: (payload: { reportId: string; idempotencyKey: IdempotencyKey }) =>
    httpsCallable<typeof payload, { status: ReportStatus; reportId: string }>(
      functions,
      'verifyReport',
    )(payload).then((r) => r.data),
  rejectReport: (payload: {
    reportId: string
    reason: 'obviously_false' | 'duplicate' | 'test_submission' | 'insufficient_detail'
    notes?: string
    idempotencyKey: IdempotencyKey
  }) =>
    httpsCallable<typeof payload, { status: ReportStatus; reportId: string }>(
      functions,
      'rejectReport',
    )(payload).then((r) => r.data),
  dispatchResponder: (payload: {
    reportId: string
    responderUid: string
    idempotencyKey: IdempotencyKey
  }) =>
    httpsCallable<typeof payload, { dispatchId: string; status: DispatchStatus; reportId: string }>(
      functions,
      'dispatchResponder',
    )(payload).then((r) => r.data),
  cancelDispatch: (payload: {
    dispatchId: string
    reason: 'responder_unavailable' | 'duplicate_report' | 'admin_error' | 'citizen_withdrew'
    idempotencyKey: IdempotencyKey
  }) =>
    httpsCallable<typeof payload, { status: DispatchStatus; dispatchId: string }>(
      functions,
      'cancelDispatch',
    )(payload).then((r) => r.data),
  closeReport: (payload: {
    reportId: string
    idempotencyKey: IdempotencyKey
    closureSummary?: string
  }) =>
    httpsCallable<typeof payload, { status: ReportStatus; reportId: string }>(
      functions,
      'closeReport',
    )(payload).then((r) => r.data),
  acceptAgencyAssistance: (payload: { requestId: string; idempotencyKey: IdempotencyKey }) =>
    httpsCallable<typeof payload, { status: 'accepted' }>(
      functions,
      'acceptAgencyAssistance',
    )(payload).then((r) => r.data),
  declineAgencyAssistance: (payload: {
    requestId: string
    reason: string
    idempotencyKey: IdempotencyKey
  }) =>
    httpsCallable<typeof payload, { status: 'declined' }>(
      functions,
      'declineAgencyAssistance',
    )(payload).then((r) => r.data),
}
