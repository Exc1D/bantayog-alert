import type {
  IncidentType,
  LocationPrecision,
  ReportSource,
  ReportStatus,
  ReporterRole,
  Severity,
  SubmissionState,
  VisibilityClass,
  VisibilityScope,
} from './enums'
import type { FirestoreTimestamp } from './auth'

/** §5.1 — reports/{reportId} */
export interface Report {
  municipalityId: string
  barangayId: string
  status: ReportStatus
  type: IncidentType
  severity: Severity
  locationApprox: { barangay: string; municipality: string }
  locationPrecision: LocationPrecision
  visibilityClass: VisibilityClass
  submissionState: SubmissionState
  source: ReportSource
  witnessPriorityFlag?: boolean
  hasPhotoAndGPS: boolean
  reporterRole?: ReporterRole
  duplicateClusterId?: string
  mergedInto?: string
  visibility: ReportVisibility
  createdAt: FirestoreTimestamp
  serverAcceptedAt: FirestoreTimestamp
  updatedAt: FirestoreTimestamp
  verifiedAt?: FirestoreTimestamp
  resolvedAt?: FirestoreTimestamp
  archivedAt?: FirestoreTimestamp
  deletedAt?: FirestoreTimestamp
  retentionExempt?: boolean
  schemaVersion: number
}

export interface ReportVisibility {
  scope: VisibilityScope
  sharedWith: string[]
  sharedReason?: string
  sharedAt?: FirestoreTimestamp
  sharedBy?: string
}

/** §5.1 — report_private/{reportId} */
export interface ReportPrivate {
  municipalityId: string
  reporterUid: string
  reporterMsisdnHash?: string
  isPseudonymous: boolean
  exactLocation?: { latitude: number; longitude: number }
  publicTrackingRef: string
  contact?: ReportContact
  createdAt: FirestoreTimestamp
  schemaVersion: number
}

export interface ReportContact {
  reporterName?: string
  phone?: string
  email?: string
  followUpConsent: boolean
}

/** §5.1 — report_ops/{reportId} */
export interface ReportOps {
  municipalityId: string
  status: ReportStatus
  severity: Severity
  createdAt: FirestoreTimestamp
  agencyIds: string[]
  classification?: string
  verifiedBy?: string
  classifiedBy?: string
  duplicateOf?: string
  escalatedTo?: string
  activeResponderCount: number
  notesSummary?: string
  requiresLocationFollowUp: boolean
  witnessPriorityFlag?: boolean
  visibility: ReportVisibility
  updatedAt: FirestoreTimestamp
  schemaVersion: number
}

/** report_inbox/{inboxId} — citizen direct write target */
export interface ReportInboxItem {
  reporterUid: string
  clientCreatedAt: FirestoreTimestamp
  payload: ReportInboxPayload
  idempotencyKey: string
}

export interface ReportInboxPayload {
  type: IncidentType
  description: string
  municipalityId: string
  barangayId: string
  locationPrecision: LocationPrecision
  exactLocation?: { latitude: number; longitude: number }
  mediaIds?: string[]
  source?: ReportSource
  severity?: Severity
}
