import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useFcmToken } from '../useFcmToken'

// Mock Firebase messaging
const mockGetToken = vi.fn()
const mockOnMessage = vi.fn(() => vi.fn())
const mockDeleteToken = vi.fn()

vi.mock('firebase/messaging', () => {
  return {
    getMessaging: vi.fn(() => ({ app: {} })),
    getToken: mockGetToken,
    onMessage: mockOnMessage,
    deleteToken: mockDeleteToken,
  }
})

// Mock Firebase auth and services
vi.mock('../services/firebase.js', () => ({
  auth: vi.fn(() => ({
    currentUser: { uid: 'test-user', isAnonymous: false },
  })),
  hasFirebaseConfig: vi.fn(() => true),
}))

// Mock Firestore
const mockUpdateDoc = vi.fn()
const mockDoc = vi.fn(() => ({}))
const mockGetDoc = vi.fn(() =>
  Promise.resolve({
    exists: () => true,
  }),
)

vi.mock('firebase/firestore', async () => {
  const actual = await vi.importActual<typeof import('firebase/firestore')>('firebase/firestore')
  return {
    ...actual,
    updateDoc: mockUpdateDoc,
    doc: mockDoc,
    getDoc: mockGetDoc,
  }
})

// Mock Functions
const mockHttpsCallable = vi.fn(() => vi.fn(() => Promise.resolve({ data: { success: true } })))

vi.mock('firebase/functions', async () => {
  const actual = await vi.importActual<typeof import('firebase/functions')>('firebase/functions')
  return {
    ...actual,
    getFunctions: vi.fn(() => ({ app: {} })),
    httpsCallable: mockHttpsCallable,
  }
})

describe('useFcmToken', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetToken.mockReset()
    mockOnMessage.mockReset()
    mockDeleteToken.mockReset()
    mockHttpsCallable.mockReset()
    mockHttpsCallable.mockReturnValue(vi.fn(() => Promise.resolve({ data: { success: true } })))

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
    mockGetToken.mockResolvedValue('test-fcm-token')

    const { result } = renderHook(() => useFcmToken())

    let success = false
    await act(async () => {
      success = await result.current.requestPermission()
    })

    expect(success).toBe(true)
    expect(Notification.requestPermission).toHaveBeenCalled()
    expect(mockGetToken).toHaveBeenCalled()
    expect(result.current.permission).toBe('granted')
    expect(result.current.token).toBe('test-fcm-token')
    expect(result.current.enabled).toBe(true)
  })

  it('should disable and clear token', async () => {
    mockDeleteToken.mockResolvedValue(undefined)

    const { result } = renderHook(() => useFcmToken())

    // First set a token
    const { Notification } = globalThis as unknown as {
      Notification: {
        permission: NotificationPermission
        requestPermission: ReturnType<typeof vi.fn>
      }
    }
    Notification.requestPermission.mockResolvedValue('granted')
    mockGetToken.mockResolvedValue('test-fcm-token')

    await act(async () => {
      await result.current.requestPermission()
    })

    expect(result.current.token).toBe('test-fcm-token')
    expect(result.current.enabled).toBe(true)

    // Now disable
    await act(async () => {
      await result.current.disable()
    })

    expect(mockDeleteToken).toHaveBeenCalled()
    expect(mockHttpsCallable).toHaveBeenCalledWith(expect.anything(), 'unsubscribeFromAlerts')
    expect(result.current.token).toBeNull()
    expect(result.current.enabled).toBe(false)
  })
})
