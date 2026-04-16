/** §5.3 — 13-state report lifecycle */
export const REPORT_STATUSES = [
  'draft_inbox',
  'new',
  'awaiting_verify',
  'verified',
  'assigned',
  'acknowledged',
  'en_route',
  'on_scene',
  'resolved',
  'closed',
  'reopened',
  'cancelled',
  'cancelled_false_report',
  'merged_as_duplicate',
  'rejected',
] as const
export type ReportStatus = (typeof REPORT_STATUSES)[number]

/** §5.4 — Dispatch state machine */
export const DISPATCH_STATUSES = [
  'pending',
  'accepted',
  'declined',
  'timed_out',
  'acknowledged',
  'in_progress',
  'resolved',
  'cancelled',
  'superseded',
] as const
export type DispatchStatus = (typeof DISPATCH_STATUSES)[number]

/** §5.1 */
export const INCIDENT_TYPES = [
  'flood',
  'fire',
  'landslide',
  'earthquake',
  'typhoon',
  'storm_surge',
  'vehicular_accident',
  'medical_emergency',
  'structural_collapse',
  'other',
] as const
export type IncidentType = (typeof INCIDENT_TYPES)[number]

export const SEVERITIES = ['critical', 'high', 'medium', 'low'] as const
export type Severity = (typeof SEVERITIES)[number]

export const REPORT_SOURCES = [
  'citizen_app',
  'citizen_sms',
  'responder_witness',
  'admin_entry',
] as const
export type ReportSource = (typeof REPORT_SOURCES)[number]

export const VISIBILITY_CLASSES = [
  'public_alertable',
  'internal_only',
  'restricted',
] as const
export type VisibilityClass = (typeof VISIBILITY_CLASSES)[number]

export const LOCATION_PRECISIONS = ['gps', 'barangay_only'] as const
export type LocationPrecision = (typeof LOCATION_PRECISIONS)[number]

export const VISIBILITY_SCOPES = ['municipality', 'shared', 'provincial'] as const
export type VisibilityScope = (typeof VISIBILITY_SCOPES)[number]

export const RESPONDER_TYPES = ['POL', 'FIR', 'MED', 'ENG', 'SAR', 'SW', 'GEN'] as const
export type ResponderType = (typeof RESPONDER_TYPES)[number]

export const ROLES = [
  'citizen',
  'responder',
  'municipal_admin',
  'agency_admin',
  'provincial_superadmin',
] as const
export type Role = (typeof ROLES)[number]

export const ACCOUNT_STATUSES = ['active', 'suspended', 'disabled'] as const
export type AccountStatus = (typeof ACCOUNT_STATUSES)[number]

export const AVAILABILITY_STATUSES = ['available', 'unavailable', 'off_duty'] as const
export type AvailabilityStatus = (typeof AVAILABILITY_STATUSES)[number]

export const SUBMISSION_STATES = ['server_accepted', 'rejected', 'duplicate'] as const
export type SubmissionState = (typeof SUBMISSION_STATES)[number]

export const DISPATCH_ACTOR_ROLES = ['municipal_admin', 'agency_admin'] as const
export type DispatchActorRole = (typeof DISPATCH_ACTOR_ROLES)[number]

export const REPORTER_ROLES = ['citizen', 'responder', 'admin'] as const
export type ReporterRole = (typeof REPORTER_ROLES)[number]

export const AGENCY_REQUEST_TYPES = [
  'BFP',
  'PNP',
  'PCG',
  'RED_CROSS',
  'DPWH',
  'OTHER',
] as const
export type AgencyRequestType = (typeof AGENCY_REQUEST_TYPES)[number]

export const AGENCY_REQUEST_STATUSES = [
  'pending',
  'accepted',
  'declined',
  'fulfilled',
  'expired',
] as const
export type AgencyRequestStatus = (typeof AGENCY_REQUEST_STATUSES)[number]
