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

/** Build a callable wrapper: `callable<Payload, Return>('functionName')` */
// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters -- P is the caller's contract
function callable<P, R>(name: string) {
  return (payload: P) => httpsCallable<P, R>(functions, name)(payload).then((r) => r.data)
}

/** Build a no-payload callable wrapper: `callableVoid<Return>('functionName')` */
function callableVoid<R>(name: string) {
  return () => httpsCallable<Record<string, never>, R>(functions, name)({}).then((r) => r.data)
}

export const callables = {
  verifyReport: callable<
    { reportId: string; idempotencyKey: IdempotencyKey; scrubbedDescription?: string },
    { status: ReportStatus; reportId: string }
  >('verifyReport'),
  rejectReport: callable<
    {
      reportId: string
      reason: 'obviously_false' | 'duplicate' | 'test_submission' | 'insufficient_detail'
      notes?: string
      idempotencyKey: IdempotencyKey
    },
    { status: ReportStatus; reportId: string }
  >('rejectReport'),
  unpublishReport: callable<
    {
      reportId: string
      reason:
        | 'sensitive_content'
        | 'privacy_request'
        | 'false_or_misleading'
        | 'legal_request'
        | 'other'
      notes?: string
      idempotencyKey: IdempotencyKey
    },
    { visibilityClass: 'internal'; reportId: string }
  >('unpublishReport'),
  setCitizenContentVisibility: callable<
    {
      surface: 'feed' | 'alerts'
      contentId: string
      visibility: 'public' | 'internal'
      reason:
        | 'sensitive_content'
        | 'privacy_request'
        | 'false_or_misleading'
        | 'legal_request'
        | 'other'
      idempotencyKey: IdempotencyKey
    },
    { surface: 'feed' | 'alerts'; contentId: string; visibility: 'public' | 'internal' }
  >('setCitizenContentVisibility'),
  dispatchResponder: callable<
    { reportId: string; responderUid: string; idempotencyKey: IdempotencyKey },
    { dispatchId: string; status: DispatchStatus; reportId: string }
  >('dispatchResponder'),
  cancelDispatch: callable<
    {
      dispatchId: string
      reason: 'responder_unavailable' | 'duplicate_report' | 'admin_error' | 'citizen_withdrew'
      idempotencyKey: IdempotencyKey
    },
    { status: DispatchStatus; dispatchId: string }
  >('cancelDispatch'),
  closeReport: callable<
    { reportId: string; idempotencyKey: IdempotencyKey; closureSummary?: string },
    { status: ReportStatus; reportId: string }
  >('closeReport'),
  shareReport: callable<
    {
      reportId: string
      targetMunicipalityId: string
      reason?: string
      idempotencyKey: IdempotencyKey
    },
    { status: 'shared' }
  >('shareReport'),
  mergeDuplicates: callable<
    { primaryReportId: string; duplicateReportIds: string[]; idempotencyKey: IdempotencyKey },
    { success: true; mergedCount: number } | { success: false; errorCode: string }
  >('mergeDuplicates'),
  addCommandChannelMessage: callable<
    { threadId: string; body: string; idempotencyKey: IdempotencyKey },
    { status: 'sent' }
  >('addCommandChannelMessage'),
  enterFieldMode: callableVoid<{ status: 'entered'; expiresAt: number }>('enterFieldMode'),
  exitFieldMode: callableVoid<{ status: 'exited' }>('exitFieldMode'),
  acceptAgencyAssistance: callable<
    { requestId: string; idempotencyKey: IdempotencyKey },
    { status: 'accepted' }
  >('acceptAgencyAssistance'),
  declineAgencyAssistance: callable<
    { requestId: string; reason: string; idempotencyKey: IdempotencyKey },
    { status: 'declined' }
  >('declineAgencyAssistance'),
  initiateShiftHandoff: callable<
    { notes: string; idempotencyKey: IdempotencyKey },
    { success: boolean; handoffId: string }
  >('initiateShiftHandoff'),
  acceptShiftHandoff: callable<
    { handoffId: string; idempotencyKey: IdempotencyKey },
    { success: boolean }
  >('acceptShiftHandoff'),
  suspendResponder: callable<
    { uid: string; idempotencyKey: IdempotencyKey },
    { uid: string; status: 'suspended' }
  >('suspendResponder'),
  revokeResponder: callable<
    { uid: string; idempotencyKey: IdempotencyKey },
    { uid: string; status: 'revoked' }
  >('revokeResponder'),
  bulkAvailabilityOverride: callable<
    { uids: string[]; status: AvailabilityStatus; idempotencyKey: IdempotencyKey },
    { updated: number }
  >('bulkAvailabilityOverride'),
  declareAlert: callable<
    {
      hazardType: string
      affectedMunicipalityIds: string[]
      message: string
      reportId?: string
      effectiveFrom?: number
      effectiveUntil?: number
      expectedResolutionAt?: number
      affectedSectors?: string[]
      affectedBarangayIds?: string[]
      roadName?: string
    },
    { alertId: string }
  >('declareAlert'),
  declareDataIncident: callable<
    {
      incidentType: string
      severity: string
      affectedCollections: string[]
      affectedDataClasses: string[]
      estimatedAffectedSubjects?: number
      summary: string
    },
    { incidentId: string }
  >('declareDataIncident'),
  recordIncidentResponseEvent: callable<
    { incidentId: string; phase: string; notes?: string },
    { eventId: string }
  >('recordIncidentResponseEvent'),
  setRetentionExempt: callable<
    { collection: string; documentId: string; exempt: boolean; reason: string },
    unknown
  >('setRetentionExempt'),
  setErasureLegalHold: callable<
    { erasureRequestId: string; hold: boolean; reason: string },
    unknown
  >('setErasureLegalHold'),
  approveErasureRequest: callable<
    { erasureRequestId: string; approved: boolean; reason?: string },
    unknown
  >('approveErasureRequest'),
  toggleMutualAidVisibility: callable<{ agencyId: string; visible: boolean }, unknown>(
    'toggleMutualAidVisibility',
  ),
  upsertProvincialResource: callable<
    {
      id?: string
      name: string
      type: string
      quantity: number
      unit: string
      location: string
      available: boolean
    },
    { id: string }
  >('upsertProvincialResource'),
  archiveProvincialResource: callable<{ id: string }, unknown>('archiveProvincialResource'),
  suspendUser: callable<
    { uid: string; idempotencyKey: IdempotencyKey },
    { uid: string; status: 'suspended' }
  >('suspendUser'),
  revokeUser: callable<
    { uid: string; idempotencyKey: IdempotencyKey },
    { uid: string; status: 'revoked' }
  >('revokeUser'),
  resetUserTotp: callable<
    { uid: string; idempotencyKey: IdempotencyKey },
    { uid: string; reset: true }
  >('resetUserTotp'),
  requestAgencyAssistance: callable<
    {
      reportId: string
      agencyId: string
      requestType: string
      priority: 'routine' | 'urgent' | 'emergency'
      message: string
      idempotencyKey: string
    },
    { requestId: string }
  >('requestAgencyAssistance'),
  listScopedOperationsMap: callableVoid<{ incidents: ScopedOperationsMapIncidentPayload[] }>(
    'listScopedOperationsMap',
  ),
  createUser: callable<
    {
      displayName: string
      phone: string
      role: UserRole
      municipalityId?: string
      agencyId?: string
      specializations?: string[]
      idempotencyKey: IdempotencyKey
    },
    { uid: string }
  >('createUser'),
  createResponder: callable<
    {
      displayName: string
      phone: string
      agencyId: string
      municipalityId?: string
      specializations?: string[]
      idempotencyKey: IdempotencyKey
    },
    { uid: string }
  >('createResponder'),
  redispatchReport: callable<
    {
      oldDispatchId: string
      newResponderUid: string
      reason: string
      idempotencyKey: IdempotencyKey
    },
    { newDispatchId: string; status: DispatchStatus; reportId: string }
  >('redispatchReport'),
  reopenReport: callable<
    { reportId: string; reason: string; idempotencyKey: IdempotencyKey },
    { status: ReportStatus; reportId: string }
  >('reopenReport'),
  escalateDispatch: callable<
    {
      dispatchId: string
      newResponderUid: string
      idempotencyKey: string
      forceOverride?: boolean
    },
    { dispatchId: string; status: DispatchStatus; reportId: string; fcmResult: string }
  >('escalateDispatch'),
  getOpsMetrics: callable<
    { timeRange: '1h' | '24h' | '7d' },
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
  >('getOpsMetrics'),
}
