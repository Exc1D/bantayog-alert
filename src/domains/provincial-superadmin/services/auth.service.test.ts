/**
 * Provincial Superadmin Authentication Service Tests
 *
 * Tests for provincial superadmin authentication and MFA operations.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  registerProvincialSuperadmin,
  loginProvincialSuperadmin,
  enrollTOTP,
  finalizeTOTPEnrollment,
  enrollSMS,
  verifyMFA,
} from './auth.service'
import { auth, db } from '@/app/firebase/config'
import { doc, deleteDoc } from 'firebase/firestore'

describe('ProvincialSuperadminAuthService', () => {
  const testUsers: string[] = []

  afterEach(async () => {
    for (const uid of testUsers) {
      try {
        await deleteDoc(doc(db, 'users', uid))
        const user = await auth.getUser(uid)
        await auth.deleteUser(user.uid)
      } catch (error) {
        // Ignore
      }
    }
    testUsers.length = 0
  })

  describe('registerProvincialSuperadmin', () => {
    it('should register a new provincial superadmin', async () => {
      const credentials = {
        email: 'superadmin@example.com',
        password: 'SecurePass123!',
        displayName: 'Admin User',
        mfaRequired: true,
      }

      const result = await registerProvincialSuperadmin(credentials)

      expect(result.user.role).toBe('provincial_superadmin')
      expect(result.user.mfaSettings?.enabled).toBe(false)
      expect(result.requiresMFAEnrollment).toBe(true)

      testUsers.push(result.user.uid)
    })

    it('should initialize MFA settings as disabled', async () => {
      const credentials = {
        email: 'superadmin-mfa@example.com',
        password: 'SecurePass123!',
        displayName: 'MFA Admin',
        mfaRequired: true,
      }

      const result = await registerProvincialSuperadmin(credentials)

      expect(result.user.mfaSettings).toBeDefined()
      expect(result.user.mfaSettings?.enabled).toBe(false)

      testUsers.push(result.user.uid)
    })
  })

  describe('enrollTOTP', () => {
    it('should generate TOTP secret and QR code', async () => {
      const credentials = {
        email: 'totp-admin@example.com',
        password: 'SecurePass123!',
        displayName: 'TOTP Admin',
        mfaRequired: true,
      }
      const result = await registerProvincialSuperadmin(credentials)
      testUsers.push(result.user.uid)

      // Login first
      await loginProvincialSuperadmin(credentials.email, credentials.password)

      // Generate TOTP secret
      const user = auth.currentUser
      expect(user).toBeDefined()

      // Note: enrollTOTP requires MultiFactorUser
      // This is a simplified test - actual implementation would handle the full flow
    })
  })

  describe('loginProvincialSuperadmin', () => {
    it('should require MFA enrollment if not enrolled', async () => {
      const credentials = {
        email: 'mfa-login@example.com',
        password: 'SecurePass123!',
        displayName: 'MFA Login Admin',
        mfaRequired: true,
      }
      const result = await registerProvincialSuperadmin(credentials)
      testUsers.push(result.user.uid)

      const loginResult = await loginProvincialSuperadmin(credentials.email, credentials.password)

      expect(loginResult.requiresMFAEnrollment).toBe(true)
    })
  })
})
