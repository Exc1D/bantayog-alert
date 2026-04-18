import { httpsCallable } from 'firebase/functions'
import { functions } from '../app/firebase'

type IdempotencyKey = string

export const callables = {
  verifyReport: (payload: { reportId: string; idempotencyKey: IdempotencyKey }) =>
    httpsCallable<typeof payload, { status: string; reportId: string }>(
      functions,
      'verifyReport',
    )(payload).then((r) => r.data),
  rejectReport: (payload: {
    reportId: string
    reason: 'obviously_false' | 'duplicate' | 'test_submission' | 'insufficient_detail'
    notes?: string
    idempotencyKey: IdempotencyKey
  }) =>
    httpsCallable<typeof payload, { status: string; reportId: string }>(
      functions,
      'rejectReport',
    )(payload).then((r) => r.data),
  dispatchResponder: (payload: {
    reportId: string
    responderUid: string
    idempotencyKey: IdempotencyKey
  }) =>
    httpsCallable<typeof payload, { dispatchId: string; status: string; reportId: string }>(
      functions,
      'dispatchResponder',
    )(payload).then((r) => r.data),
  cancelDispatch: (payload: {
    dispatchId: string
    reason: 'responder_unavailable' | 'duplicate_report' | 'admin_error' | 'citizen_withdrew'
    idempotencyKey: IdempotencyKey
  }) =>
    httpsCallable<typeof payload, { status: string; dispatchId: string }>(
      functions,
      'cancelDispatch',
    )(payload).then((r) => r.data),
}
