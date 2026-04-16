import type { AccountStatus, AvailabilityStatus, ResponderType } from './enums'
import type { FirestoreTimestamp } from './auth'

/** users/{uid} */
export interface User {
  displayName?: string
  phone?: string
  barangayId?: string
  municipalityId?: string
  createdAt: FirestoreTimestamp
}

/** responders/{uid} */
export interface Responder {
  agencyId: string
  municipalityId: string
  responderType: ResponderType
  specializations: string[]
  availabilityStatus: AvailabilityStatus
  accountStatus: AccountStatus
  createdAt: FirestoreTimestamp
  updatedAt: FirestoreTimestamp
}
