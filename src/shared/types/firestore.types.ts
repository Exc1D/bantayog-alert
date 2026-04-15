/**
 * Firestore data model types for Bantayog Alert
 *
 * Defines the structure of all collections in the database.
 * Implements a three-tier report model for privacy and security.
 */

import { UserRole } from './auth.types'

/**
 * Report status lifecycle
 *
 * Reports progress through these statuses:
 * 1. pending → verified (by municipal admin)
 * 2. verified → assigned (to responder)
 * 3. assigned → responding (responder en route)
 * 4. responding → resolved (incident handled)
 * 5. Any status → false_alarm (if not a real incident)
 */
export type ReportStatus =
  | 'pending'
  | 'verified'
  | 'assigned'
  | 'responding'
  | 'resolved'
  | 'false_alarm'

/**
 * Incident severity levels
 *
 * Used to prioritize response and determine escalation procedures.
 */
export type IncidentSeverity = 'low' | 'medium' | 'high' | 'critical'

/**
 * Incident type classification
 *
 * Standard categories for disaster and emergency reporting.
 */
export type IncidentType =
  | 'flood'
  | 'earthquake'
  | 'landslide'
  | 'fire'
  | 'typhoon'
  | 'medical_emergency'
  | 'accident'
  | 'infrastructure'
  | 'crime'
  | 'other'

/**
 * Geographic coordinates
 */
export interface Coordinates {
  latitude: number
  longitude: number
}

/**
 * THREE-TIER REPORT MODEL
 *
 * Reports are split across three collections for privacy and security:
 * 1. reports - Public data (anyone can read)
 * 2. report_private - Private details (admin only)
 * 3. report_ops - Operational data (dispatch and status)
 */

/**
 * Tier 1: Public Report Data
 *
 * Accessible to all authenticated users.
 * Contains only approximate location and anonymous information.
 */
export interface Report {
  id: string
  createdAt: number
  updatedAt: number

  // Approximate location (public)
  approximateLocation: {
    barangay: string
    municipality: string
    // Coordinates fuzzed to ~100m precision
    approximateCoordinates: Coordinates
  }

  // Basic incident info (public)
  incidentType: IncidentType
  severity: IncidentSeverity
  status: ReportStatus
  description: string // Sanitized, no PII

  // Reporting metadata (public)
  isAnonymous: boolean

  // Verification metadata
  verifiedAt?: number
  verifiedBy?: string // UID of municipal admin

  // Resolution metadata
  resolvedAt?: number
  resolvedBy?: string // UID of responder or admin
  resolutionNotes?: string // Public explanation (sanitized)
}

/**
 * Tier 2: Private Report Data
 *
 * Accessible only to administrators (municipal and provincial).
 * Contains full details including contact information and specific location.
 */
export interface ReportPrivate {
  id: string // Matches Report.id
  reportId: string // Foreign key to reports collection

  // Exact location (private)
  exactLocation: {
    address: string
    coordinates: Coordinates
    landmarks?: string
  }

  // Reporter information (private)
  reporterUserId?: string // null if anonymous
  reporterContact?: {
    name: string
    phone: string
    email?: string
  }

  // Additional details (private)
  numberOfPeople?: number
  specialCircumstances?: string
  injuries?: string
  damageAssessment?: string

  // Media (private)
  photoUrls?: string[]
  videoUrls?: string[]

  // Admin notes (not visible to public)
  adminNotes?: string
}

/**
 * Tier 3: Operational Report Data
 *
 * Accessible only to responders and administrators.
 * Contains dispatch information and operational status.
 */
export interface ReportOps {
  id: string // Matches Report.id
  reportId: string // Foreign key to reports collection

  // Dispatch information
  assignedTo?: string // UID of responder
  assignedAt?: number
  assignedBy?: string // UID of admin who assigned

  // Response tracking
  responderStatus?: 'en_route' | 'on_scene' | 'needs_assistance' | 'completed'
  responderNotes?: string
  responderArrivalTime?: number
  responderDepartureTime?: number

  // Escalation
  escalatedAt?: number
  escalatedBy?: string
  escalationReason?: string

  // Resources deployed
  resourcesDeployed?: string[]
  personnelCount?: number

  // Timeline (operations log)
  timeline: OpsTimelineEntry[]
}

/**
 * Operational timeline entry
 *
 * Tracks all actions taken on a report.
 */
export interface OpsTimelineEntry {
  timestamp: number
  action: string
  performedBy: string // UID
  notes?: string
}

/**
 * MFA Settings
 *
 * Multi-factor authentication settings for provincial superadmins.
 */
export interface MFASettings {
  enabled: boolean
  factorId?: string // Firebase multi-factor ID
  enrollmentTime?: number
  lastVerified?: number
}

/**
 * Incident collection
 *
 * Created when a report is verified. Groups related reports together.
 * One incident can have multiple reports.
 */
export interface Incident {
  id: string
  createdAt: number
  updatedAt: number

  // Incident details
  incidentType: IncidentType
  severity: IncidentSeverity
  status: ReportStatus

  // Location
  location: {
    barangay: string
    municipality: string
    coordinates: Coordinates
  }

  // Related reports
  reportIds: string[] // All reports associated with this incident

  // Verified information
  verifiedBy: string // UID of municipal admin
  verifiedAt: number

  // Resolution
  resolvedAt?: number
  resolvedBy?: string
  resolutionSummary?: string

  // Emergency declaration (provincial superadmin only)
  emergencyDeclared?: boolean
  emergencyDeclaredAt?: number
  emergencyDeclaredBy?: string // UID of provincial superadmin
  emergencyLevel?: 'state_of_calamity' | 'state_of_emergency'
}

/**
 * Responder profile
 *
 * Responders have additional fields beyond the user profile.
 */
export interface Responder {
  uid: string // Matches UserProfile.uid

  // Contact information (required)
  phoneNumber: string
  phoneVerified: boolean // OTP verified during registration

  // Availability
  isOnDuty: boolean
  isAvailable: boolean // Available for assignment

  // Current assignment
  currentAssignment?: {
    reportId: string
    incidentId: string
    assignedAt: number
  }

  // Capabilities
  capabilities: string[] // e.g., ['medical', 'rescue', 'firefighting']
  certifications?: string[]

  // Performance metrics
  totalAssignments: number
  completedAssignments: number
  averageResponseTime?: number // in minutes

  // Location tracking (optional, for dispatch optimization)
  lastKnownLocation?: {
    coordinates: Coordinates
    timestamp: number
  }
}

/**
 * Municipality data
 *
 * Defines the administrative boundaries and assigned admins.
 */
export interface Municipality {
  id: string
  name: string // Unique identifier (e.g., "daet")

  // Administrative
  province: string // "Camarines Norte"

  // Assigned administrators
  admins: string[] // List of UIDs

  // Statistics
  totalReports: number
  activeIncidents: number
  totalResponders: number

  // Metadata
  createdAt: number
  updatedAt: number
}

/**
 * Alert / System Notification
 *
 * One-way notifications sent to users (push, in-app, SMS, email).
 */
export interface Alert {
  id: string
  createdAt: number

  // Target audience
  targetAudience: 'all' | 'municipality' | 'role'
  targetMunicipality?: string // Required if targetAudience is 'municipality'
  targetRole?: UserRole // Required if targetAudience is 'role'

  // Alert content
  title: string
  message: string
  severity: 'info' | 'warning' | 'emergency'

  // Delivery
  deliveryMethod: ('push' | 'in_app' | 'sms' | 'email')[]
  sentAt?: number
  deliveryStatus?: 'pending' | 'sent' | 'failed'

  // Optional link
  linkUrl?: string

  // Expiration
  expiresAt?: number

  // Creator
  createdBy: string // UID

  // ---- Government Alert Extensions ----
  // These fields are used when the alert originates from a government
  // agency (MDRRMO, PAGASA, NDRRMC, etc.) and targets affected areas
  // rather than a specific audience.

  /** Geographic areas covered by this alert */
  affectedAreas?: {
    municipalities: string[]
    barangays?: string[]
  }

  /** Type of hazard or event this alert is about */
  type?:
    | 'evacuation'
    | 'weather'
    | 'health'
    | 'infrastructure'
    | 'other'

  /** Originating government agency */
  source?:
    | 'MDRRMO'
    | 'PAGASA'
    | 'DOH'
    | 'DPWH'
    | 'PHIVOLCS'
    | 'Other'

  /** Link to the original advisory or bulletin */
  sourceUrl?: string

  /**
   * Whether this alert is currently active.
   * Defaults to true when undefined (active).
   * Firestore rules check: `isActive == true || isActive == null`
   */
  isActive?: boolean
}

/**
 * Audit log entry
 *
 * Tracks all administrative and sensitive actions for accountability.
 */
export interface AuditLog {
  id: string
  timestamp: number

  // Who
  performedBy: string // UID
  performedByRole: UserRole

  // What
  action: string // e.g., "CREATE_USER", "VERIFY_REPORT", "DECLARE_EMERGENCY"
  resourceType: string // e.g., "report", "user", "incident"
  resourceId?: string

  // Where
  municipality?: string

  // Details
  details: string // Human-readable description
  changes?: Record<string, unknown> // Before/after for updates

  // Metadata
  ipAddress?: string
  userAgent?: string
}

/**
 * Data retention settings
 *
 * Configures auto-archive and auto-delete policies (GDPR compliance).
 */
export interface DataRetentionSettings {
  retentionMonths: number // Default: 6
  archiveAfterMonths: number // Default: 3
  autoDelete: boolean
}

/**
 * Archived report
 *
 * Old reports moved to cold storage before deletion.
 */
export interface ArchivedReport {
  originalReportId: string
  archivedAt: number
  scheduledDeletion: number

  // Full report data (compressed)
  report: Report
  reportPrivate?: ReportPrivate
  reportOps?: ReportOps

  // Retention metadata
  retentionPolicy: DataRetentionSettings
}
