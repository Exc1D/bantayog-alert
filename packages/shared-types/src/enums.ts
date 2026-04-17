// Role literals MUST match spec §5.7 exactly. Do NOT add `dispatcher`,
// `provincial_admin`, or `super_admin` — those do not exist in the spec's role model.
export type UserRole =
  | 'citizen'
  | 'responder'
  | 'municipal_admin'
  | 'agency_admin'
  | 'provincial_superadmin'

export type AccountStatus = 'active' | 'suspended' | 'revoked' | 'pending_verification'

export type ReportStatus =
  | 'draft'
  | 'new'
  | 'awaiting_verify'
  | 'verified'
  | 'assigned'
  | 'in_progress'
  | 'resolved'
  | 'closed'
  | 'rejected'
  | 'duplicate'

export type DispatchStatus =
  | 'pending'
  | 'accepted'
  | 'declined'
  | 'acknowledged'
  | 'in_progress'
  | 'resolved'
  | 'cancelled'

export type Severity = 'info' | 'low' | 'medium' | 'high' | 'critical'

export type ReportType =
  | 'flood'
  | 'fire'
  | 'earthquake'
  | 'typhoon'
  | 'landslide'
  | 'medical'
  | 'accident'
  | 'structural'
  | 'other'

export type IncidentSource = 'web' | 'sms' | 'responder_witness' | 'manual_entry'

export type VisibilityClass = 'public' | 'private' | 'restricted'

export type HazardType =
  | 'flood_zone'
  | 'landslide_zone'
  | 'earthquake_fault'
  | 'storm_surge'
  | 'volcanic'

export type TelemetryStatus = 'online' | 'stale' | 'offline'

export type ReporterRole = 'citizen' | 'responder'
