import { httpsCallable } from 'firebase/functions'
import { functions } from '../app/firebase'
import type {
  ReportStatus,
  DispatchStatus,
  ScopedOperationsMapIncidentPayload,
  UserRole,
} from '@bantayog/shared-types'

type IdempotencyKey = string
type AvailabilityStatus = 'available' | 'unavailable' | 'off_duty'

export const callables = {
  verifyReport: (payload: {
    reportId: string
    idempotencyKey: IdempotencyKey
    scrubbedDescription?: string
  }) =>
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
  unpublishReport: (payload: {
    reportId: string
    reason:
      | 'sensitive_content'
      | 'privacy_request'
      | 'false_or_misleading'
      | 'legal_request'
      | 'other'
    notes?: string
    idempotencyKey: IdempotencyKey
  }) =>
    httpsCallable<typeof payload, { visibilityClass: 'internal'; reportId: string }>(
      functions,
      'unpublishReport',
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
  shareReport: (payload: {
    reportId: string
    targetMunicipalityId: string
    reason?: string
    idempotencyKey: IdempotencyKey
  }) =>
    httpsCallable<typeof payload, { status: 'shared' }>(
      functions,
      'shareReport',
    )(payload).then((r) => r.data),
  mergeDuplicates: (payload: {
    primaryReportId: string
    duplicateReportIds: string[]
    idempotencyKey: IdempotencyKey
  }) =>
    httpsCallable<typeof payload, { success: true; mergedCount: number } | { success: false; errorCode: string }>(
      functions,
      'mergeDuplicates',
    )(payload).then((r) => r.data),
  addCommandChannelMessage: (payload: {
    threadId: string
    body: string
    idempotencyKey: IdempotencyKey
  }) =>
    httpsCallable<typeof payload, { status: 'sent' }>(
      functions,
      'addCommandChannelMessage',
    )(payload).then((r) => r.data),
  enterFieldMode: () =>
    httpsCallable<Record<string, never>, { status: 'entered'; expiresAt: number }>(
      functions,
      'enterFieldMode',
    )({}).then((r) => r.data),
  exitFieldMode: () =>
    httpsCallable<Record<string, never>, { status: 'exited' }>(
      functions,
      'exitFieldMode',
    )({}).then((r) => r.data),
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
  initiateShiftHandoff: (payload: { notes: string; idempotencyKey: IdempotencyKey }) =>
    httpsCallable<typeof payload, { success: boolean; handoffId: string }>(
      functions,
      'initiateShiftHandoff',
    )(payload).then((r) => r.data),
  acceptShiftHandoff: (payload: { handoffId: string; idempotencyKey: IdempotencyKey }) =>
    httpsCallable<typeof payload, { success: boolean }>(
      functions,
      'acceptShiftHandoff',
    )(payload).then((r) => r.data),
  suspendResponder: (payload: { uid: string; idempotencyKey: IdempotencyKey }) =>
    httpsCallable<typeof payload, { uid: string; status: 'suspended' }>(
      functions,
      'suspendResponder',
    )(payload).then((r) => r.data),
  revokeResponder: (payload: { uid: string; idempotencyKey: IdempotencyKey }) =>
    httpsCallable<typeof payload, { uid: string; status: 'revoked' }>(
      functions,
      'revokeResponder',
    )(payload).then((r) => r.data),
  bulkAvailabilityOverride: (payload: {
    uids: string[]
    status: AvailabilityStatus
    idempotencyKey: IdempotencyKey
  }) =>
    httpsCallable<typeof payload, { updated: number }>(
      functions,
      'bulkAvailabilityOverride',
    )(payload).then((r) => r.data),
  declareAlert: (payload: {
    hazardType: string
    affectedMunicipalityIds: string[]
    message: string
    reportId?: string
  }) =>
    httpsCallable<typeof payload, { alertId: string }>(
      functions,
      'declareAlert',
    )(payload).then((r) => r.data),
  declareDataIncident: (payload: {
    incidentType: string
    severity: string
    affectedCollections: string[]
    affectedDataClasses: string[]
    estimatedAffectedSubjects?: number
    summary: string
  }) =>
    httpsCallable<typeof payload, { incidentId: string }>(
      functions,
      'declareDataIncident',
    )(payload).then((r) => r.data),
  recordIncidentResponseEvent: (payload: { incidentId: string; phase: string; notes?: string }) =>
    httpsCallable<typeof payload, { eventId: string }>(
      functions,
      'recordIncidentResponseEvent',
    )(payload).then((r) => r.data),
  setRetentionExempt: (payload: {
    collection: string
    documentId: string
    exempt: boolean
    reason: string
  }) => httpsCallable<typeof payload>(functions, 'setRetentionExempt')(payload).then((r) => r.data),
  setErasureLegalHold: (payload: {
    erasureRequestId: string
    hold: boolean
    reason: string
  }) =>
    httpsCallable<typeof payload>(
      functions,
      'setErasureLegalHold',
    )(payload).then((r) => r.data),
  approveErasureRequest: (payload: {
    erasureRequestId: string
    approved: boolean
    reason?: string
  }) =>
    httpsCallable<typeof payload>(functions, 'approveErasureRequest')(payload).then((r) => r.data),
  toggleMutualAidVisibility: (payload: { agencyId: string; visible: boolean }) =>
    httpsCallable<typeof payload>(
      functions,
      'toggleMutualAidVisibility',
    )(payload).then((r) => r.data),
  upsertProvincialResource: (payload: {
    id?: string
    name: string
    type: string
    quantity: number
    unit: string
    location: string
    available: boolean
  }) =>
    httpsCallable<typeof payload, { id: string }>(
      functions,
      'upsertProvincialResource',
    )(payload).then((r) => r.data),
  archiveProvincialResource: (payload: { id: string }) =>
    httpsCallable<typeof payload>(
      functions,
      'archiveProvincialResource',
    )(payload).then((r) => r.data),
  suspendUser: (payload: { uid: string; idempotencyKey: IdempotencyKey }) =>
    httpsCallable<typeof payload, { uid: string; status: 'suspended' }>(
      functions,
      'suspendUser',
    )(payload).then((r) => r.data),
  revokeUser: (payload: { uid: string; idempotencyKey: IdempotencyKey }) =>
    httpsCallable<typeof payload, { uid: string; status: 'revoked' }>(
      functions,
      'revokeUser',
    )(payload).then((r) => r.data),
  resetUserTotp: (payload: { uid: string; idempotencyKey: IdempotencyKey }) =>
    httpsCallable<typeof payload, { uid: string; reset: true }>(
      functions,
      'resetUserTotp',
    )(payload).then((r) => r.data),
  requestAgencyAssistance: (payload: {
    reportId: string
    agencyId: string
    requestType: string
    priority: 'routine' | 'urgent' | 'emergency'
    message: string
    idempotencyKey: string
  }) =>
    httpsCallable<typeof payload, { requestId: string }>(
      functions,
      'requestAgencyAssistance',
    )(payload).then((r) => r.data),
  listScopedOperationsMap: () =>
    httpsCallable<Record<string, never>, { incidents: ScopedOperationsMapIncidentPayload[] }>(
      functions,
      'listScopedOperationsMap',
    )({}).then((r) => r.data),
  createUser: (payload: {
    displayName: string
    phone: string
    role: UserRole
    municipalityId?: string
    agencyId?: string
    specializations?: string[]
    idempotencyKey: IdempotencyKey
  }) =>
    httpsCallable<typeof payload, { uid: string }>(
      functions,
      'createUser',
    )(payload).then((r) => r.data),
  createResponder: (payload: {
    displayName: string
    phone: string
    agencyId: string
    municipalityId?: string
    specializations?: string[]
    idempotencyKey: IdempotencyKey
  }) =>
    httpsCallable<typeof payload, { uid: string }>(
      functions,
      'createResponder',
    )(payload).then((r) => r.data),
  redispatchReport: (payload: {
    oldDispatchId: string
    newResponderUid: string
    reason: string
    idempotencyKey: IdempotencyKey
  }) =>
    httpsCallable<
      typeof payload,
      { newDispatchId: string; status: DispatchStatus; reportId: string }
    >(
      functions,
      'redispatchReport',
    )(payload).then((r) => r.data),
  reopenReport: (payload: { reportId: string; reason: string; idempotencyKey: IdempotencyKey }) =>
    httpsCallable<typeof payload, { status: ReportStatus; reportId: string }>(
      functions,
      'reopenReport',
    )(payload).then((r) => r.data),
  escalateDispatch: (payload: {
    dispatchId: string
    newResponderUid: string
    idempotencyKey: string
    forceOverride?: boolean
  }) =>
    httpsCallable<
      typeof payload,
      {
        dispatchId: string
        status: DispatchStatus
        reportId: string
        fcmResult: string
      }
    >(
      functions,
      'escalateDispatch',
    )(payload).then((r) => r.data),
  getOpsMetrics: (payload: { timeRange: '1h' | '24h' | '7d' }) =>
    httpsCallable<
      typeof payload,
      {
        timeRange: string
        scope: { type: string; id: string }
        metrics: {
          totalDispatches: number
          acceptedCount: number
          declinedCount: number
          escalatedCount: number
          needsAdminCount: number
          fcmSuccessCount: number
          fcmFailureCount: number
          avgAcceptSeconds: number | null
          fcmSuccessRate: number
        }
      }
    >(
      functions,
      'getOpsMetrics',
    )(payload).then((r) => r.data),
}
