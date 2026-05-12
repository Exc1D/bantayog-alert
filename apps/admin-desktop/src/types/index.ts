export type Severity = 'HIGH' | 'MEDIUM' | 'LOW'

export type ReportType = 'FLOOD' | 'FIRE' | 'LANDSLIDE' | 'ACCIDENT' | 'MEDICAL' | 'OTHER'

export type ReportStatus = 'ACTIVE' | 'PENDING' | 'RESOLVED' | 'ESCALATED' | 'CRITICAL'

export type Role =
  | 'SUPERADMIN'
  | 'PROVINCIAL_ADMIN'
  | 'MUNICIPAL_ADMIN'
  | 'AGENCY_ADMIN'
  | 'RESPONDER'
  | 'CITIZEN'

export type AccountStatus = 'ACTIVE' | 'SUSPENDED' | 'PENDING_VERIFICATION'

export type DispatchStatus = 'DISPATCHED' | 'EN_ROUTE' | 'ON_SCENE' | 'RETURNING' | 'STANDBY'

export interface Report {
  id: string
  type: ReportType
  severity: Severity
  status: ReportStatus
  municipality: string
  barangay: string
  description: string
  reporterName: string
  reporterPhone: string
  latitude: number
  longitude: number
  createdAt: string
  updatedAt: string
  resolvedAt?: string
  assignedAgency?: string
  responderCount?: number
}

export interface ReportPrivate {
  reporterPhone: string
  reporterEmail?: string
  reporterAddress?: string
  idDocumentType?: string
  idDocumentNumber?: string
  ipAddress?: string
  deviceInfo?: string
}

export interface ReportOps {
  internalNotes: string[]
  dispatchLog: Dispatch[]
  resourceAllocations: string[]
  communicationLog: string[]
  escalationHistory: string[]
}

export interface Dispatch {
  id: string
  agency: string
  status: DispatchStatus
  dispatchedAt: string
  arrivedAt?: string
  responders: Responder[]
}

export interface Responder {
  id: string
  name: string
  agency: string
  status: DispatchStatus
  latitude?: number
  longitude?: number
  lastSeenAt?: string
}

export interface Agency {
  id: string
  name: string
  code: string
  type: 'FIRE' | 'POLICE' | 'MEDICAL' | 'COASTGUARD' | 'ENGINEERING' | 'NGO'
  contactNumber: string
  activeResponders: number
  totalResponders: number
}

export interface User {
  id: string
  name: string
  email: string
  phone: string
  role: Role
  municipality?: string
  agency?: string
  status: AccountStatus
  lastLoginAt?: string
  createdAt: string
  avatarUrl?: string
}

export interface Municipality {
  id: string
  name: string
  barangays: string[]
  population: number
  activeIncidents: number
  activeResponders: number
  avgResponseTime: string
  unresolvedOver24h: number
  adminOnDuty?: User
  latitude: number
  longitude: number
}

export interface AuditLogEntry {
  id: string
  actorId: string
  actorName: string
  actorRole: Role
  action: string
  targetType: string
  targetId?: string
  details: string
  privateDataAccessed: boolean
  ipAddress?: string
  timestamp: string
}

export interface EscalationRequest {
  id: string
  reportId: string
  municipality: string
  requestedBy: string
  requesterRole: Role
  reason: string
  evidence: string[]
  status: 'PENDING' | 'APPROVED' | 'DECLINED'
  createdAt: string
  reviewedAt?: string
  reviewedBy?: string
  reviewNotes?: string
}

export interface DataErasureRequest {
  id: string
  requesterName: string
  requesterEmail: string
  reportIds: string[]
  reason: string
  status: 'PENDING' | 'APPROVED' | 'DECLINED' | 'IN_PROGRESS'
  createdAt: string
  reviewedAt?: string
  reviewedBy?: string
  reviewNotes?: string
}

export interface SystemHealthMetric {
  service: string
  status: 'HEALTHY' | 'DEGRADED' | 'DOWN'
  latency: number
  uptime: number
  lastChecked: string
  errorRate?: number
  queueDepth?: number
}

export interface ProviderHealth {
  name: string
  status: 'HEALTHY' | 'DEGRADED' | 'DOWN' | 'CIRCUIT_OPEN'
  successRate: number
  avgLatency: number
  lastFailure?: string
  circuitBreakerOpen?: boolean
}

export interface ShiftHandoff {
  id: string
  outgoingAdminId: string
  outgoingAdminName: string
  incomingAdminId: string
  incomingAdminName: string
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED'
  snapshot: {
    activeIncidents: number
    pendingEscalations: number
    activeResponders: number
    municipalitiesAffected: number
  }
  pendingItems: string[]
  notes: string
  createdAt: string
  acceptedAt?: string
}

export interface EmergencyDeclaration {
  id: string
  type: ReportType
  severity: Severity
  municipalities: string[]
  declaredBy: string
  declarationText: string
  status: 'ACTIVE' | 'LIFTED'
  createdAt: string
  liftedAt?: string
  liftedBy?: string
}

export interface MunicipalPerformance {
  municipality: string
  activeIncidents: number
  activeResponders?: number
  totalResponders?: number
  avgResponseTime?: string
  unresolvedOver24h?: number
  adminOnDuty?: boolean
  adminName?: string
}

export interface AnomalyAlert {
  id: string
  municipality: string
  type: string
  message: string
  severity: Severity
  detectedAt: string
  dismissedAt?: string
}

export interface ActivityEvent {
  id: string
  timestamp: string
  type: 'INCIDENT' | 'RESOLVED' | 'DISPATCH' | 'ESCALATION' | 'USER' | 'SYSTEM'
  actor: string
  actorRole: Role
  action: string
  target?: string
  municipality?: string
  targetId?: string
}

export interface Notification {
  id: string
  title: string
  message: string
  type: 'info' | 'success' | 'warning' | 'error'
  read: boolean
  createdAt: string
}
