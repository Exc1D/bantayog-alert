import { httpsCallable } from 'firebase/functions'
import { functions } from '../app/firebase'
import type { ReportStatus, DispatchStatus } from '@bantayog/shared-types'

type IdempotencyKey = string
type AvailabilityStatus = 'available' | 'unavailable' | 'off_duty'

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
  massAlertReachPlanPreview: (payload: {
    targetScope: { municipalityIds: string[] }
    message: string
  }) =>
    httpsCallable<
      typeof payload,
      {
        route: 'direct' | 'ndrrmc_escalation'
        fcmCount: number
        smsCount: number
        segmentCount: number
        unicodeWarning: boolean
      }
    >(
      functions,
      'massAlertReachPlanPreview',
    )(payload).then((r) => r.data),
  sendMassAlert: (payload: {
    reachPlan: {
      route: 'direct' | 'ndrrmc_escalation'
      fcmCount: number
      smsCount: number
      segmentCount: number
      unicodeWarning: boolean
    }
    message: string
    targetScope: { municipalityIds: string[] }
    idempotencyKey: string
  }) =>
    httpsCallable<typeof payload, { requestId: string }>(
      functions,
      'sendMassAlert',
    )(payload).then((r) => r.data),
  requestMassAlertEscalation: (payload: {
    message: string
    targetScope: { municipalityIds: string[] }
    evidencePack?: { linkedReportIds: string[]; pagasaSignalRef?: string; notes?: string }
    idempotencyKey: string
  }) =>
    httpsCallable<typeof payload, { requestId: string }>(
      functions,
      'requestMassAlertEscalation',
    )(payload).then((r) => r.data),
  forwardMassAlertToNDRRMC: (payload: {
    requestId: string
    forwardMethod: 'email' | 'sms' | 'portal'
    ndrrmcRecipient: string
  }) =>
    httpsCallable<typeof payload, { success: boolean }>(
      functions,
      'forwardMassAlertToNDRRMC',
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
  initiateBreakGlass: (payload: { codeA: string; codeB: string; reason: string }) =>
    httpsCallable<typeof payload, { sessionId: string }>(
      functions,
      'initiateBreakGlass',
    )(payload).then((r) => r.data),
  deactivateBreakGlass: () =>
    httpsCallable<Record<string, never>>(functions, 'deactivateBreakGlass')({}).then((r) => r.data),
  declareEmergency: (payload: {
    hazardType: string
    affectedMunicipalityIds: string[]
    message: string
  }) =>
    httpsCallable<typeof payload, { alertId: string }>(
      functions,
      'declareEmergency',
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
}
