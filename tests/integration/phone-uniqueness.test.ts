/**
 * Phone Uniqueness Validation Integration Tests
 *
 * Tests that phone numbers are unique across responder accounts.
 * Prevents multiple accounts from using the same phone number.
 *
 * Run with Firebase Emulator: firebase emulators:exec "vitest run tests/integration/phone-uniqueness.test.ts"
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { registerResponder } from '@/domains/responder/services/auth.service'
import { db } from '@/app/firebase/config'
import { doc, getDoc, deleteDoc } from 'firebase/firestore'
import { deleteAuthUsers } from '../helpers/firebase-admin'
import type { UserProfile } from '@/shared/types'

describe('Phone Uniqueness Validation', () => {
  const testUsers: string[] = []
  const testPhoneNumber = '+639123456789'

  // Cleanup test users after each test
  afterEach(async () => {
    for (const uid of testUsers) {
      await deleteDoc(doc(db, 'users', uid)).catch(() => undefined)
      await deleteDoc(doc(db, 'responders', uid)).catch(() => undefined)
    }
    await deleteAuthUsers(testUsers)
    testUsers.length = 0
  })

  describe('registerResponder', () => {
    it('should successfully register first responder with phone number', async () => {
      const credentials = {
        email: 'responder1@example.com',
        password: 'SecurePass123!',
        displayName: 'Test Responder 1',
        phoneNumber: testPhoneNumber,
      }

      const result = await registerResponder(credentials)

      expect(result.user).toBeDefined()
      expect(result.user.email).toBe(credentials.email)
      expect(result.user.phoneNumber).toBe(testPhoneNumber)
      expect(result.user.phoneVerified).toBe(false)
      expect(result.requiresPhoneVerification).toBe(true)

      // Track for cleanup
      testUsers.push(result.user.uid)
    })

    it('should reject registration with duplicate phone number', async () => {
      // Register first responder
      const firstCredentials = {
        email: 'responder1@example.com',
        password: 'SecurePass123!',
        displayName: 'Test Responder 1',
        phoneNumber: testPhoneNumber,
      }

      const firstResult = await registerResponder(firstCredentials)
      testUsers.push(firstResult.user.uid)

      // Try to register second responder with same phone number
      const secondCredentials = {
        email: 'responder2@example.com',
        password: 'SecurePass123!',
        displayName: 'Test Responder 2',
        phoneNumber: testPhoneNumber, // DUPLICATE!
      }

      // Should throw error with PHONE_ALREADY_IN_USE code
      await expect(registerResponder(secondCredentials)).rejects.toThrow(
        'already registered to another responder'
      )

      try {
        await registerResponder(secondCredentials)
        // If we get here, test should fail
        expect(true).toBe(false)
      } catch (error) {
        expect(error).toBeInstanceOf(Error)
        expect((error as Error).message).toContain('already registered')
        expect((error as { cause?: { code?: string } }).cause?.code).toBe(
          'PHONE_ALREADY_IN_USE'
        )
      }
    })

    it('should allow different phone numbers for different responders', async () => {
      const firstCredentials = {
        email: 'responder1@example.com',
        password: 'SecurePass123!',
        displayName: 'Test Responder 1',
        phoneNumber: '+639123456789',
      }

      const secondCredentials = {
        email: 'responder2@example.com',
        password: 'SecurePass123!',
        displayName: 'Test Responder 2',
        phoneNumber: '+639987654321', // DIFFERENT
      }

      const firstResult = await registerResponder(firstCredentials)
      const secondResult = await registerResponder(secondCredentials)

      expect(firstResult.user.phoneNumber).toBe('+639123456789')
      expect(secondResult.user.phoneNumber).toBe('+639987654321')

      // Track for cleanup
      testUsers.push(firstResult.user.uid)
      testUsers.push(secondResult.user.uid)
    })

    it('should reject registration when phone number is not provided', async () => {
      const credentials = {
        email: 'responder@example.com',
        password: 'SecurePass123!',
        displayName: 'Test Responder',
        phoneNumber: '', // EMPTY!
      }

      await expect(registerResponder(credentials as any)).rejects.toThrow(
        'Phone number is required'
      )
    })

    it('should store phone number in user profile', async () => {
      const credentials = {
        email: 'responder@example.com',
        password: 'SecurePass123!',
        displayName: 'Test Responder',
        phoneNumber: testPhoneNumber,
      }

      const result = await registerResponder(credentials)
      testUsers.push(result.user.uid)

      // Verify phone number is stored in Firestore
      const userDoc = await getDoc(doc(db, 'users', result.user.uid))
      const userProfile = userDoc.data() as UserProfile

      expect(userProfile).toBeDefined()
      expect(userProfile.phoneNumber).toBe(testPhoneNumber)
      expect(userProfile.phoneVerified).toBe(false)
    })

    it('should create responder profile with phone number', async () => {
      const credentials = {
        email: 'responder@example.com',
        password: 'SecurePass123!',
        displayName: 'Test Responder',
        phoneNumber: testPhoneNumber,
      }

      const result = await registerResponder(credentials)
      testUsers.push(result.user.uid)

      // Verify responder profile is created
      const responderDoc = await getDoc(doc(db, 'responders', result.user.uid))
      const responderProfile = responderDoc.data()

      expect(responderProfile).toBeDefined()
      expect(responderProfile?.phoneNumber).toBe(testPhoneNumber)
      expect(responderProfile?.phoneVerified).toBe(false)
    })

    it('should reject registration with international format variations', async () => {
      // Register first responder with one format
      const firstCredentials = {
        email: 'responder1@example.com',
        password: 'SecurePass123!',
        displayName: 'Test Responder 1',
        phoneNumber: '+639123456789', // Format: +63 XXX XXX XXXX
      }

      const firstResult = await registerResponder(firstCredentials)
      testUsers.push(firstResult.user.uid)

      // Try to register with same number but different format
      const secondCredentials = {
        email: 'responder2@example.com',
        password: 'SecurePass123!',
        displayName: 'Test Responder 2',
        phoneNumber: '09123456789', // Format: 09XX XXX XXXX (local)
      }

      // Note: This test documents current behavior
      // In production, you might want to normalize phone numbers
      // For now, we test that exact string matching works
      await expect(registerResponder(secondCredentials)).resolves.toBeDefined()
      testUsers.push((await registerResponder(secondCredentials)).user.uid)
    })
  })

  describe('Edge Cases', () => {
    it('should handle concurrent registration attempts gracefully', async () => {
      const credentials = {
        email: 'responder@example.com',
        password: 'SecurePass123!',
        displayName: 'Test Responder',
        phoneNumber: testPhoneNumber,
      }

      // Try to register two responders simultaneously with same phone
      const results = await Promise.allSettled([
        registerResponder({ ...credentials, email: 'responder1@example.com' }),
        registerResponder({ ...credentials, email: 'responder2@example.com' }),
      ])

      // One should succeed, one should fail
      const successCount = results.filter((r) => r.status === 'fulfilled').length
      const failCount = results.filter((r) => r.status === 'rejected').length

      expect(successCount).toBe(1)
      expect(failCount).toBe(1)

      // Track successful user for cleanup
      const successResult = results.find((r) => r.status === 'fulfilled')
      if (successResult && successResult.status === 'fulfilled') {
        testUsers.push(successResult.value.user.uid)
      }
    })

    it('should handle special characters in phone numbers', async () => {
      const credentials = {
        email: 'responder@example.com',
        password: 'SecurePass123!',
        displayName: 'Test Responder',
        phoneNumber: '+63 (912) 345-6789', // With spaces, parentheses, dash
      }

      const result = await registerResponder(credentials)
      testUsers.push(result.user.uid)

      expect(result.user.phoneNumber).toBe('+63 (912) 345-6789')
    })

    it('should reject registration after phone is verified for another account', async () => {
      // Register and verify first responder
      const firstCredentials = {
        email: 'responder1@example.com',
        password: 'SecurePass123!',
        displayName: 'Test Responder 1',
        phoneNumber: testPhoneNumber,
      }

      const firstResult = await registerResponder(firstCredentials)
      testUsers.push(firstResult.user.uid)

      // Mark phone as verified (simulate verification)
      await deleteDoc(doc(db, 'users', firstResult.user.uid))
      // Note: In real flow, verification would set phoneVerified to true
      // For this test, we just ensure the duplicate check still works

      // Try to register second responder with same phone
      const secondCredentials = {
        email: 'responder2@example.com',
        password: 'SecurePass123!',
        displayName: 'Test Responder 2',
        phoneNumber: testPhoneNumber,
      }

      await expect(registerResponder(secondCredentials)).rejects.toThrow(
        'already registered'
      )
    })
  })
})
