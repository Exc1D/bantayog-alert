/* eslint-disable @typescript-eslint/no-deprecated */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useFcmToken } from '../useFcmToken'

// Mock Firebase messaging — hoisted, must not reference outer variables
vi.mock('firebase/messaging', () => ({
  getMessaging: vi.fn(() => ({ app: {} })),
  getToken: vi.fn(),
  onMessage: vi.fn(() => vi.fn()),
  deleteToken: vi.fn(),
}))

// Mock Firebase auth and services
vi.mock('../../services/firebase.js', () => ({
  auth: vi.fn(() => ({
    currentUser: { uid: 'test-user', isAnonymous: false },
  })),
  hasFirebaseConfig: vi.fn(() => true),
  fns: vi.fn(() => ({ app: {} })),
  httpsCallable: vi.fn(() => vi.fn(() => Promise.resolve({ data: { success: true } }))),
  db: vi.fn(() => ({ app: {} })),
}))

// Mock Firestore
vi.mock('firebase/firestore', async () => {
  const actual = await vi.importActual<typeof import('firebase/firestore')>('firebase/firestore')
  return {
    ...actual,
    setDoc: vi.fn(() => Promise.resolve()),
    doc: vi.fn(() => ({})),
  }
})

import { getToken, deleteToken } from 'firebase/messaging'
import { setDoc } from 'firebase/firestore'
import { httpsCallable } from '../../services/firebase.js'

describe('useFcmToken', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Mock Notification API
    Object.defineProperty(globalThis, 'Notification', {
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

  it('should request permission and get token', async () => {
    const { Notification } = globalThis as unknown as {
      Notification: {
        permission: NotificationPermission
        requestPermission: ReturnType<typeof vi.fn>
      }
    }
    Notification.requestPermission.mockResolvedValue('granted')
    vi.mocked(getToken).mockResolvedValue('test-fcm-token')

    const { result } = renderHook(() => useFcmToken())

    let success = false
    await act(async () => {
      success = await result.current.requestPermission()
    })

    expect(success).toBe(true)
    expect(Notification.requestPermission).toHaveBeenCalled()
    expect(getToken).toHaveBeenCalled()
    expect(httpsCallable).toHaveBeenCalledWith(expect.anything(), 'subscribeToAlerts')
    const subscribeCallable = vi.mocked(httpsCallable).mock.results[0]?.value
    expect(subscribeCallable).toHaveBeenCalledWith({ token: 'test-fcm-token' })
    expect(setDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ fcmToken: 'test-fcm-token' }),
      { merge: true },
    )
    expect(result.current.permission).toBe('granted')
    expect(result.current.token).toBe('test-fcm-token')
    expect(result.current.enabled).toBe(true)
  })

  it('should disable and clear token', async () => {
    vi.mocked(deleteToken).mockResolvedValue(true)

    const { result } = renderHook(() => useFcmToken())

    // First set a token
    const { Notification } = globalThis as unknown as {
      Notification: {
        permission: NotificationPermission
        requestPermission: ReturnType<typeof vi.fn>
      }
    }
    Notification.requestPermission.mockResolvedValue('granted')
    vi.mocked(getToken).mockResolvedValue('test-fcm-token')

    await act(async () => {
      await result.current.requestPermission()
    })

    expect(result.current.token).toBe('test-fcm-token')
    expect(result.current.enabled).toBe(true)

    // Now disable
    await act(async () => {
      await result.current.disable()
    })

    expect(deleteToken).toHaveBeenCalled()
    expect(httpsCallable).toHaveBeenCalledWith(expect.anything(), 'unsubscribeFromAlerts')
    // Verify the callable was actually invoked with the token
    const unsubscribeFromAlerts = vi.mocked(httpsCallable).mock.results[1]?.value
    expect(unsubscribeFromAlerts).toHaveBeenCalledWith({ token: 'test-fcm-token' })
    expect(setDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ fcmToken: null }),
      { merge: true },
    )
    expect(result.current.token).toBeNull()
    expect(result.current.enabled).toBe(false)
  })
})
