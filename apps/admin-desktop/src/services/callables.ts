import { httpsCallable } from 'firebase/functions'
import { functions } from '../app/firebase'
import type { ReportStatus, DispatchStatus, UserRole } from '@bantayog/shared-types'
import type {
  UpdateMunicipalityContactInput,
  UpdateMunicipalityContactOutput,
} from '@bantayog/shared-validators'

type IdempotencyKey = string
type AvailabilityStatus = 'available' | 'unavailable' | 'off_duty'

/** Build a callable wrapper: `callable<Payload, Return>('functionName')` */
// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters -- P is the caller's contract
function callable<P, R>(name: string) {
  return (payload: P) => httpsCallable<P, R>(functions, name)(payload).then((r) => r.data)
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
  // Backend-only operation; see docs/runbooks/pilot-demo.md#backend-only-operations.
  cancelDispatch: callable<
    {
      dispatchId: string
      reason: 'responder_unavailable' | 'duplicate_report' | 'admin_error' | 'citizen_withdrew'
      idempotencyKey: IdempotencyKey
    },
    { status: DispatchStatus; dispatchId: string }
  >('cancelDispatch'),
  // Backend-only operation; see docs/runbooks/pilot-demo.md#backend-only-operations.
  closeReport: callable<
    { reportId: string; idempotencyKey: IdempotencyKey; closureSummary?: string },
    { status: ReportStatus; reportId: string }
  >('closeReport'),
  mergeDuplicates: callable<
    { primaryReportId: string; duplicateReportIds: string[]; idempotencyKey: IdempotencyKey },
    { success: true; mergedCount: number } | { success: false; errorCode: string }
  >('mergeDuplicates'),
  suspendResponder: callable<
    { uid: string; idempotencyKey: IdempotencyKey },
    { uid: string; status: 'suspended' }
  >('suspendResponder'),
  // Backend-only operation; see docs/runbooks/pilot-demo.md#backend-only-operations.
  revokeResponder: callable<
    { uid: string; idempotencyKey: IdempotencyKey },
    { uid: string; status: 'revoked' }
  >('revokeResponder'),
  // Backend-only operation; see docs/runbooks/pilot-demo.md#backend-only-operations.
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
  updateMunicipalityContact: callable<
    UpdateMunicipalityContactInput,
    UpdateMunicipalityContactOutput
  >('updateMunicipalityContact'),
  // Backend-only operation; see docs/runbooks/pilot-demo.md#backend-only-operations.
  setRetentionExempt: callable<
    { collection: string; documentId: string; exempt: boolean; reason: string },
    unknown
  >('setRetentionExempt'),
  // Backend-only operation; see docs/runbooks/pilot-demo.md#backend-only-operations.
  setErasureLegalHold: callable<
    { erasureRequestId: string; hold: boolean; reason: string },
    unknown
  >('setErasureLegalHold'),
  // Backend-only operation; see docs/runbooks/pilot-demo.md#backend-only-operations.
  approveErasureRequest: callable<
    { erasureRequestId: string; approved: boolean; reason?: string },
    unknown
  >('approveErasureRequest'),
  suspendUser: callable<
    { uid: string; idempotencyKey: IdempotencyKey },
    { uid: string; status: 'suspended' }
  >('suspendUser'),
  // Backend-only operation; see docs/runbooks/pilot-demo.md#backend-only-operations.
  revokeUser: callable<
    { uid: string; idempotencyKey: IdempotencyKey },
    { uid: string; status: 'revoked' }
  >('revokeUser'),
  // Backend-only operation; see docs/runbooks/pilot-demo.md#backend-only-operations.
  resetUserTotp: callable<
    { uid: string; idempotencyKey: IdempotencyKey },
    { uid: string; reset: true }
  >('resetUserTotp'),
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
  // Backend-only operation; see docs/runbooks/pilot-demo.md#backend-only-operations.
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
