import type { FirestoreTimestamp } from './auth'

/** alerts/{alertId} — CF write only */
export interface Alert {
  title: string
  body: string
  targetMunicipalityIds: string[]
  targetBarangayIds?: string[]
  hazardType?: string
  severity: string
  sentBy: string
  sentByRole: string
  sentAt: FirestoreTimestamp
  channels: ('fcm' | 'sms')[]
  schemaVersion: number
}

/** emergencies/{emergencyId} — CF write only */
export interface Emergency {
  title: string
  description: string
  declaredBy: string
  declaredAt: FirestoreTimestamp
  affectedMunicipalityIds: string[]
  status: 'active' | 'resolved'
  resolvedAt?: FirestoreTimestamp
  schemaVersion: number
}
