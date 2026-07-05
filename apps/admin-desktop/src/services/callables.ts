import { httpsCallable } from 'firebase/functions'
import { functions } from '../app/firebase'
import type { ReportStatus, DispatchStatus } from '@bantayog/shared-types'
import type {
  UpdateMunicipalityContactInput,
  UpdateMunicipalityContactOutput,
} from '@bantayog/shared-validators'

type IdempotencyKey = string

export type CancelDispatchReason =
  | 'responder_unavailable'
  | 'duplicate_report'
  | 'admin_error'
  | 'citizen_withdrew'

export type AvailabilityStatus = 'available' | 'unavailable' | 'off_duty'

/** Build a callable wrapper: `callable<Payload, Return>('functionName')` */
// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters -- P is the caller's contract
function callable<P, R>(name: string) {
  return (payload: P) => httpsCallable<P, R>(functions, name)(payload).then((r) => r.data)
}

// Backend-only operations (user suspend/revoke, erasure, ...) have no frontend
// wrapper by design; see docs/runbooks/pilot-demo.md#backend-only-operations.
export const callables = {
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
    { updated: number; skipped: number; skippedUids: string[] }
  >('bulkAvailabilityOverride'),
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
  closeReport: callable<
    { reportId: string; idempotencyKey: IdempotencyKey; closureSummary?: string },
    { reportId: string; status: 'closed' }
  >('closeReport'),
  reopenReport: callable<
    { reportId: string; reason: string; idempotencyKey: IdempotencyKey },
    { reportId: string; status: 'reopened' }
  >('reopenReport'),
  mergeDuplicates: callable<
    { primaryReportId: string; duplicateReportIds: string[]; idempotencyKey: IdempotencyKey },
    { success: true; mergedCount: number } | { success: false; errorCode: string }
  >('mergeDuplicates'),
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
    { dispatchId: string; reason: CancelDispatchReason; idempotencyKey: IdempotencyKey },
    { dispatchId: string; status: DispatchStatus }
  >('cancelDispatch'),
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
