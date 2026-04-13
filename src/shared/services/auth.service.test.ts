/**
 * Authentication Service Tests
 *
 * Tests for shared authentication operations.
 * Run with Firebase Emulator: npm run emulators:exec
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  registerBase,
  loginBase,
  getUserProfile,
  createUserProfile,
  signOut,
  sendPasswordReset,
  refreshIdToken,
  isAuthenticated,
  getCurrentUser,
} from './auth.service'
import { db } from '@/app/firebase/config'
import { doc, getDoc, deleteDoc } from 'firebase/firestore'
import { deleteAuthUsers } from '../../../tests/helpers/firebase-admin'
import type { UserProfile } from '@/shared/types'

describe('AuthService', () => {
  const testUsers: string[] = []

  // Cleanup test users after each test
  afterEach(async () => {
    for (const uid of testUsers) {
      await deleteDoc(doc(db, 'users', uid)).catch(() => undefined)
      await deleteDoc(doc(db, 'responders', uid)).catch(() => undefined)
    }
    await deleteAuthUsers(testUsers)
    testUsers.length = 0
  })

  describe('registerBase', () => {
    it('should create a new user with email and password', async () => {
      const credentials = {
        email: 'test@example.com',
        password: 'SecurePass123!',
        displayName: 'Test User',
      }

      const result = await registerBase(credentials, 'citizen')

      expect(result.user).toBeDefined()
      expect(result.user.email).toBe(credentials.email)
      expect(result.user.role).toBe('citizen')
      expect(result.user.displayName).toBe(credentials.displayName)
      expect(result.requiresEmailVerification).toBe(true)

      // Track for cleanup
      testUsers.push(result.user.uid)
    })

    it('should create user profile in Firestore', async () => {
      const credentials = {
        email: 'profile-test@example.com',
        password: 'SecurePass123!',
        displayName: 'Profile Test',
      }

      const result = await registerBase(credentials, 'citizen')

      // Verify profile was created in Firestore
      const profileDoc = await getDoc(doc(db, 'users', result.user.uid))
      expect(profileDoc.exists()).toBe(true)

      const profile = profileDoc.data() as UserProfile
      expect(profile.uid).toBe(result.user.uid)
      expect(profile.email).toBe(credentials.email)
      expect(profile.role).toBe('citizen')
      expect(profile.isActive).toBe(true)

      testUsers.push(result.user.uid)
    })

    it('should reject duplicate email addresses', async () => {
      const credentials = {
        email: 'duplicate@example.com',
        password: 'SecurePass123!',
      }

      // Register first user
      await registerBase(credentials, 'citizen')

      // Try to register with same email
      await expect(registerBase(credentials, 'citizen')).rejects.toThrow()
    })

    it('should reject weak passwords', async () => {
      const credentials = {
        email: 'weak@example.com',
        password: '123', // Too weak
      }

      await expect(registerBase(credentials, 'citizen')).rejects.toThrow()
    })
  })

  describe('loginBase', () => {
    let testUserUid: string

    beforeEach(async () => {
      // Create a test user for login tests
      const credentials = {
        email: 'login-test@example.com',
        password: 'SecurePass123!',
        displayName: 'Login Test',
      }
      const result = await registerBase(credentials, 'citizen')
      testUserUid = result.user.uid
    })

    it('should login with valid credentials', async () => {
      const result = await loginBase('login-test@example.com', 'SecurePass123!')

      expect(result.user).toBeDefined()
      expect(result.user.email).toBe('login-test@example.com')
      expect(result.user.role).toBe('citizen')
    })

    it('should reject invalid email', async () => {
      await expect(loginBase('wrong@example.com', 'SecurePass123!')).rejects.toThrow()
    })

    it('should reject invalid password', async () => {
      await expect(loginBase('login-test@example.com', 'WrongPassword123!')).rejects.toThrow()
    })

    it('should indicate email verification required', async () => {
      const result = await loginBase('login-test@example.com', 'SecurePass123!')

      expect(result.requiresEmailVerification).toBe(true)
    })

    it('should load user profile from Firestore', async () => {
      const result = await loginBase('login-test@example.com', 'SecurePass123!')

      expect(result.user.uid).toBe(testUserUid)
      expect(result.user.createdAt).toBeDefined()
      expect(result.user.isActive).toBe(true)
    })
  })

  describe('getUserProfile', () => {
    it('should fetch user profile from Firestore', async () => {
      const credentials = {
        email: 'profile-fetch@example.com',
        password: 'SecurePass123!',
        displayName: 'Profile Fetch',
      }
      const result = await registerBase(credentials, 'citizen')

      const profile = await getUserProfile(result.user.uid)

      expect(profile).toBeDefined()
      expect(profile?.uid).toBe(result.user.uid)
      expect(profile?.email).toBe(credentials.email)

      testUsers.push(result.user.uid)
    })

    it('should return null for non-existent user', async () => {
      const profile = await getUserProfile('non-existent-user-id')
      expect(profile).toBeNull()
    })
  })

  describe('createUserProfile', () => {
    it('should create user profile with additional data', async () => {
      const uid = 'test-user-uid'
      const email = 'custom-profile@example.com'

      const profile = await createUserProfile(uid, email, 'responder', {
        displayName: 'Custom Responder',
        phoneNumber: '+639123456789',
      })

      expect(profile.uid).toBe(uid)
      expect(profile.email).toBe(email)
      expect(profile.role).toBe('responder')
      expect(profile.phoneNumber).toBe('+639123456789')

      // Cleanup
      testUsers.push(uid)
    })
  })

  describe('signOut', () => {
    it('should sign out current user', async () => {
      // First, sign in
      const credentials = {
        email: 'signout-test@example.com',
        password: 'SecurePass123!',
      }
      await registerBase(credentials, 'citizen')
      await loginBase(credentials.email, credentials.password)

      // Verify user is authenticated
      expect(isAuthenticated()).toBe(true)

      // Sign out
      await signOut()

      // Verify user is signed out
      expect(isAuthenticated()).toBe(false)
    })
  })

  describe('sendPasswordReset', () => {
    it('should send password reset email', async () => {
      // Note: This test only verifies no error is thrown
      // Actual email sending is handled by Firebase Auth
      await expect(sendPasswordReset('reset@example.com')).resolves.not.toThrow()
    })
  })

  describe('refreshIdToken', () => {
    it('should refresh ID token for authenticated user', async () => {
      const credentials = {
        email: 'token-refresh@example.com',
        password: 'SecurePass123!',
      }
      await registerBase(credentials, 'citizen')
      await loginBase(credentials.email, credentials.password)

      const token = await refreshIdToken()
      expect(token).toBeDefined()
      expect(typeof token).toBe('string')
    })

    it('should return null for unauthenticated user', async () => {
      await signOut()
      const token = await refreshIdToken()
      expect(token).toBeNull()
    })
  })

  describe('getCurrentUser', () => {
    it('should return current Firebase user', async () => {
      const credentials = {
        email: 'current-user@example.com',
        password: 'SecurePass123!',
      }
      await registerBase(credentials, 'citizen')
      await loginBase(credentials.email, credentials.password)

      const user = getCurrentUser()
      expect(user).toBeDefined()
      expect(user?.email).toBe(credentials.email)
    })

    it('should return null when no user is signed in', async () => {
      await signOut()
      const user = getCurrentUser()
      expect(user).toBeNull()
    })
  })

  describe('isAuthenticated', () => {
    it('should return true when user is signed in', async () => {
      const credentials = {
        email: 'auth-check@example.com',
        password: 'SecurePass123!',
      }
      await registerBase(credentials, 'citizen')
      await loginBase(credentials.email, credentials.password)

      expect(isAuthenticated()).toBe(true)
    })

    it('should return false when no user is signed in', async () => {
      await signOut()
      expect(isAuthenticated()).toBe(false)
    })
  })
})
