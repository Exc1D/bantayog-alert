import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useFcmToken } from '../useFcmToken'

// Mock Firebase messaging and auth
const mockGetToken = vi.fn()
const mockOnMessage = vi.fn(() => vi.fn())
vi.mock('firebase/messaging/sw', () => ({
  getToken: mockGetToken,
  onMessage: mockOnMessage,
}))
vi.mock('../services/firebase.js', () => ({
  auth: vi.fn(() => ({
    currentUser: { uid: 'test-user', isAnonymous: false },
  })),
  hasFirebaseConfig: vi.fn(() => true),
}))

// Mock Firestore and Functions
vi.mock('firebase/firestore', async () => {
  const actual = await vi.importActual('firebase/firestore')
  return {
    ...actual,
    updateDoc: vi.fn(),
    doc: vi.fn(),
    getDoc: vi.fn(() =>
      Promise.resolve({
        exists: () => true,
      }),
    ),
  }
})
vi.mock('firebase/functions', async () => {
  const actual = await vi.importActual('firebase/functions')
  return {
    ...actual,
    getFunctions: vi.fn(),
    httpsCallable: vi.fn(() => Promise.resolve({ data: { success: true } })),
  }
})

describe('useFcmToken', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Mock Notification API
    Object.defineProperty(global, 'Notification', {
      value: {
        permission: 'default' as NotificationPermission,
        requestPermission: vi.fn(),
      },
      writable: true,
      configurable: true,
    })
  })

  it('should return permission as default initially', () => {
    const { result } = renderHook(() => useFcmToken())
    expect(result.current.permission).toBe('default')
    expect(result.current.token).toBeNull()
    expect(result.current.enabled).toBe(false)
  })

  it('should have requestPermission and disable methods', () => {
    const { result } = renderHook(() => useFcmToken())
    expect(typeof result.current.requestPermission).toBe('function')
    expect(typeof result.current.disable).toBe('function')
  })
})
