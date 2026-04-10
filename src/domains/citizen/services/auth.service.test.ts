/**
 * Citizen Authentication Service Tests
 *
 * Tests for citizen-specific authentication operations.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { registerCitizen, loginCitizen } from './auth.service'
import { auth, db } from '@/app/firebase/config'
import { doc, deleteDoc } from 'firebase/firestore'

describe('CitizenAuthService', () => {
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

  describe('registerCitizen', () => {
    it('should register a new citizen', async () => {
      const credentials = {
        email: 'citizen@example.com',
        password: 'SecurePass123!',
        displayName: 'Juan Dela Cruz',
        phoneNumber: '+639173456789',
      }

      const result = await registerCitizen(credentials)

      expect(result.user.role).toBe('citizen')
      expect(result.user.phoneNumber).toBe(credentials.phoneNumber)
      expect(result.requiresEmailVerification).toBe(true)

      testUsers.push(result.user.uid)
    })

    it('should register citizen without phone number', async () => {
      const credentials = {
        email: 'citizen-nophone@example.com',
        password: 'SecurePass123!',
        displayName: 'Maria Santos',
      }

      const result = await registerCitizen(credentials)

      expect(result.user.role).toBe('citizen')
      expect(result.user.phoneNumber).toBeUndefined()

      testUsers.push(result.user.uid)
    })
  })

  describe('loginCitizen', () => {
    beforeEach(async () => {
      const credentials = {
        email: 'citizen-login@example.com',
        password: 'SecurePass123!',
        displayName: 'Login Citizen',
      }
      const result = await registerCitizen(credentials)
      testUsers.push(result.user.uid)
    })

    it('should login citizen with valid credentials', async () => {
      const result = await loginCitizen('citizen-login@example.com', 'SecurePass123!')

      expect(result.user.role).toBe('citizen')
      expect(result.user.email).toBe('citizen-login@example.com')
    })
  })
})
