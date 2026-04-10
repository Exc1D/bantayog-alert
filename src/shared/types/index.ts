/**
 * Shared types barrel export
 *
 * Central export point for all shared types used across the application.
 */

// Authentication types
export type {
  UserRole,
  AuthCredentials,
  ResponderCredentials,
  MunicipalAdminCredentials,
  ProvincialSuperadminCredentials,
  UserProfile,
  AuthResult,
  CustomClaims,
  UserSession,
  AccountRecoveryRequest,
  AuthError,
  AuthErrorCode,
} from './auth.types'

// Firestore types
export type {
  ReportStatus,
  IncidentSeverity,
  IncidentType,
  Coordinates,
  Report,
  ReportPrivate,
  ReportOps,
  OpsTimelineEntry,
  Incident,
  Responder,
  Municipality,
  Alert,
  AuditLog,
  DataRetentionSettings,
  ArchivedReport,
  MFASettings,
} from './firestore.types'
