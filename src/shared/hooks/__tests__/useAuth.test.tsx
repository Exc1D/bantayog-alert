/**
 * useAuth Hook Tests
 *
 * Tests for the useAuth custom hook.
 * Firebase Auth is mocked for unit testing.
 */

import { renderHook, waitFor, act } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useAuth } from '../useAuth'

// Mock Firebase Auth
vi.mock('firebase/auth', () => ({
  signInWithEmailAndPassword: vi.fn(),
  signOut: vi.fn(),
  onAuthStateChanged: vi.fn(),
}))

// Mock Firebase config
vi.mock('@/app/firebase/config', () => ({
  auth: {},
}))

import {
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
} from 'firebase/auth'
import type { User } from 'firebase/auth'

describe('useAuth', () => {
  let mockUnsubscribe: () => void
  let mockUser: User

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks()

    // Setup mock user
    mockUser = {
      uid: 'test-user-123',
      email: 'test@example.com',
      emailVerified: true,
      displayName: 'Test User',
      isAnonymous: false,
      providerId: 'password',
      metadata: {},
      phoneNumber: null,
      photoURL: null,
      providerData: [],
      refreshToken: '',
      tenantId: null,
      delete: vi.fn(),
      getIdToken: vi.fn(),
      getIdTokenResult: vi.fn(),
      linkWithCredential: vi.fn(),
      linkWithPhoneNumber: vi.fn(),
      linkWithPopup: vi.fn(),
      linkWithRedirect: vi.fn(),
      reauthenticateWithCredential: vi.fn(),
      reauthenticateWithPhoneNumber: vi.fn(),
      reauthenticateWithPopup: vi.fn(),
      reauthenticateWithRedirect: vi.fn(),
      reload: vi.fn(),
      sendEmailVerification: vi.fn(),
      toJSON: vi.fn(),
      unlink: vi.fn(),
      updateEmail: vi.fn(),
      updatePassword: vi.fn(),
      updatePhoneNumber: vi.fn(),
      updateProfile: vi.fn(),
      verifyBeforeUpdateEmail: vi.fn(),
    }

    // Setup mock unsubscribe
    mockUnsubscribe = vi.fn()

    // Mock onAuthStateChanged to call callback immediately
    vi.mocked(onAuthStateChanged).mockImplementation((auth, callback) => {
      // Call callback with no user initially
      callback(null)

      // Return unsubscribe function
      return mockUnsubscribe
    })

    // Mock signInWithEmailAndPassword
    vi.mocked(signInWithEmailAndPassword).mockResolvedValue({
      user: mockUser,
      providerId: 'password',
      operationType: 'signIn',
    })

    // Mock signOut
    vi.mocked(firebaseSignOut).mockResolvedValue(undefined)
  })

  describe('when no user is authenticated', () => {
    it('should return null user and loading false', async () => {
      const { result } = renderHook(() => useAuth())

      // Wait for useEffect to run
      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.user).toBeNull()
    })
  })

  describe('when user is authenticated', () => {
    it('should return user object', async () => {
      // Update mock to return user
      vi.mocked(onAuthStateChanged).mockImplementation((auth, callback) => {
        callback(mockUser)
        return mockUnsubscribe
      })

      const { result } = renderHook(() => useAuth())

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.user).toBeDefined()
      expect(result.current.user?.uid).toBe('test-user-123')
      expect(result.current.user?.email).toBe('test@example.com')
    })
  })

  describe('signIn', () => {
    it('should call signInWithEmailAndPassword with credentials', async () => {
      const { result } = renderHook(() => useAuth())

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      await act(async () => {
        await result.current.signIn('test@example.com', 'password123')
      })

      expect(signInWithEmailAndPassword).toHaveBeenCalledWith(
        expect.anything(),
        'test@example.com',
        'password123'
      )
    })

    it('should handle sign in errors', async () => {
      vi.mocked(signInWithEmailAndPassword).mockRejectedValue(new Error('Invalid credentials'))

      const { result } = renderHook(() => useAuth())

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      await expect(
        act(async () => {
          await result.current.signIn('test@example.com', 'wrong-password')
        })
      ).rejects.toThrow('Invalid credentials')
    })
  })

  describe('signOut', () => {
    it('should call firebase signOut', async () => {
      const { result } = renderHook(() => useAuth())

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      await act(async () => {
        await result.current.signOut()
      })

      expect(firebaseSignOut).toHaveBeenCalledWith(expect.anything())
    })

    it('should handle sign out errors', async () => {
      vi.mocked(firebaseSignOut).mockRejectedValue(new Error('Sign out failed'))

      const { result } = renderHook(() => useAuth())

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      await expect(
        act(async () => {
          await result.current.signOut()
        })
      ).rejects.toThrow('Sign out failed')
    })
  })

  describe('cleanup', () => {
    it('should unsubscribe on unmount', async () => {
      const { result, unmount } = renderHook(() => useAuth())

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      unmount()

      expect(mockUnsubscribe).toHaveBeenCalled()
    })
  })
})
