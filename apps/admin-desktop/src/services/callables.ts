import { httpsCallable } from 'firebase/functions'
import { functions } from '../app/firebase'
import type { ReportStatus, DispatchStatus } from '@bantayog/shared-types'
import type {
  UpdateMunicipalityContactInput,
  UpdateMunicipalityContactOutput,
} from '@bantayog/shared-validators'

type IdempotencyKey = string

/** Build a callable wrapper: `callable<Payload, Return>('functionName')` */
// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters -- P is the caller's contract
function callable<P, R>(name: string) {
  return (payload: P) => httpsCallable<P, R>(functions, name)(payload).then((r) => r.data)
}

// Backend-only operations (cancelDispatch, closeReport, mergeDuplicates, user/responder
// suspend/revoke, erasure, reopenReport, ...) have no frontend wrapper by design;
// see docs/runbooks/pilot-demo.md#backend-only-operations.
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
