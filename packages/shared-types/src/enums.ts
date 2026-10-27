// Role literals MUST match spec §5.7 exactly. Do NOT add `dispatcher`,
// `provincial_admin`, or `super_admin` — those do not exist in the spec's role model.
export type UserRole =
  | 'citizen'
  | 'responder'
  | 'municipal_admin'
  | 'agency_admin'
  | 'provincial_superadmin'

export type AccountStatus = 'active' | 'suspended' | 'disabled' | 'revoked'

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
  | 'needs_admin'
  | 'escalated'

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
