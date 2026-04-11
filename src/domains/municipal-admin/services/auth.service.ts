/**
 * Municipal Admin Authentication Service
 *
 * Handles authentication for municipal administrators.
 * Municipal admins manage disaster response within their assigned municipality.
 *
 * Requirements:
 * - Email/password authentication
 * - Municipality assignment MANDATORY
 * - Can only view/manage data within their municipality
 * - Promoted to role by provincial superadmin
 */

import { registerBase, loginBase } from '@/shared/services/auth.service'
import { getDocument } from '@/shared/services/firestore.service'
import type {
  AuthResult,
  MunicipalAdminCredentials,
  UserProfile,
  Municipality,
} from '@/shared/types'

/**
 * Register a new municipal admin
 *
 * Creates Firebase Auth user and Firestore profile.
 * Municipality assignment is MANDATORY.
 *
 * Note: Only provincial superadmins can promote users to municipal admin role.
 * This function is called by the superadmin during user creation.
 */
export async function registerMunicipalAdmin(
  credentials: MunicipalAdminCredentials
): Promise<AuthResult> {
  // Validate municipality is present
  if (!credentials.municipality) {
    throw new Error('Municipality assignment is required for municipal admins')
  }

  // CRITICAL: Verify municipality exists
  const municipality = await getDocument<Municipality>('municipalities', credentials.municipality)

  if (!municipality) {
    throw new Error(
      `Municipality "${credentials.municipality}" does not exist. Please select a valid municipality.`,
      { cause: { code: 'MUNICIPALITY_NOT_FOUND' } }
    )
  }

  const additionalData: Partial<UserProfile> = {
    displayName: credentials.displayName,
    municipality: credentials.municipality,
  }

  return registerBase(credentials, 'municipal_admin', additionalData)
}

/**
 * Municipal admin login
 *
 * Standard email/password login for municipal admins.
 * Custom claims will enforce municipality-level data access.
 */
export async function loginMunicipalAdmin(email: string, password: string): Promise<AuthResult> {
  return loginBase(email, password)
}
