// Role literals MUST match spec §5.7 exactly. Do NOT add `dispatcher`,
// `provincial_admin`, or `super_admin` — those do not exist in the spec's role model.
export type UserRole =
  | 'citizen'
  | 'responder'
  | 'municipal_admin'
  | 'agency_admin'
  | 'provincial_superadmin'

export type AccountStatus = 'active' | 'suspended' | 'disabled'

// Report lifecycle — spec §5.3 (13 states + `draft_inbox` pre-materialisation).
export type ReportStatus =
  | 'draft_inbox'
  | 'new'
  | 'awaiting_verify'
  | 'verified'
  | 'assigned'
  | 'acknowledged'
  | 'en_route'
  | 'on_scene'
  | 'resolved'
  | 'closed'
  | 'reopened'
  | 'rejected'
  | 'cancelled'
  | 'cancelled_false_report'
  | 'merged_as_duplicate'

// Active statuses used for analytics/listing queries — ensures consistent "active incident" counting across screens.
export const ACTIVE_REPORT_STATUSES: readonly ReportStatus[] = [
  'new',
  'awaiting_verify',
  'verified',
  'assigned',
  'acknowledged',
  'en_route',
  'on_scene',
] as const

// Dispatch lifecycle — spec §5.4 (Phase 3c: en_route + on_scene).
export type DispatchStatus =
  | 'pending'
  | 'accepted'
  | 'acknowledged'
  | 'en_route'
  | 'on_scene'
  | 'resolved'
  | 'declined'
  | 'timed_out'
  | 'cancelled'
  | 'superseded'
  | 'unable_to_complete'

export type Severity = 'low' | 'medium' | 'high'

export type ReportType =
  | 'flood'
  | 'fire'
  | 'earthquake'
  | 'typhoon'
  | 'landslide'
  | 'storm_surge'
  | 'medical'
  | 'accident'
  | 'structural'
  | 'security'
  | 'other'

export type IncidentSource = 'web' | 'sms' | 'responder_witness'

// Spec §5.1 — `visibilityClass` gates public readability on `reports/{id}`.
export type VisibilityClass = 'internal' | 'public_alertable'

// Spec §22.2 — hazard taxonomy. Bare literals, not `_zone` suffixed.
export type HazardType = 'flood' | 'landslide' | 'storm_surge'

export type HazardZoneType = 'reference' | 'custom'

export type HazardZoneScope = 'provincial' | 'municipality'

export type TelemetryStatus = 'online' | 'stale' | 'offline'

export type ReporterRole = 'citizen' | 'responder'

export type VisibilityScope = 'municipality' | 'shared' | 'provincial'

export type MediaKind = 'image' | 'video' | 'audio'

export type AssistanceRequestType = 'BFP' | 'PNP' | 'PCG' | 'RED_CROSS' | 'DPWH' | 'OTHER'

export type AssistanceRequestStatus = 'pending' | 'accepted' | 'declined' | 'fulfilled' | 'expired'

export type MassAlertStatus =
  | 'queued'
  | 'submitted_to_pdrrmo'
  | 'forwarded_to_ndrrmc'
  | 'acknowledged_by_ndrrmc'
  | 'cancelled'

export type SmsProviderId = 'semaphore' | 'globelabs'

export type SmsDirection = 'outbound' | 'inbound'

export type SmsOutboxStatus =
  | 'queued'
  | 'sent'
  | 'delivered'
  | 'failed'
  | 'undelivered'
  | 'abandoned'

export type SmsPurpose =
  | 'receipt_ack'
  | 'status_update'
  | 'verification'
  | 'resolution'
  | 'mass_alert'
  | 'emergency_declaration'

export type LocationPrecision = 'gps' | 'barangay' | 'municipality'
