import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import { FcmSetup } from './App.js'
import { Capacitor } from '@capacitor/core'

// Mocks must be hoisted so vi.mock factories can reference them
const mockRegister = vi.hoisted(() => vi.fn())
const mockUser = vi.hoisted(() => ({ uid: 'test-uid' }))

// Mutable user ref for tests that need to change the user
let currentUser: { uid: string } | null = mockUser

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: vi.fn() },
}))

vi.mock('@bantayog/shared-ui', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useAuth: () => ({ user: currentUser }),
  ProtectedRoute: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock('./hooks/useRegisterFcmToken', () => ({
  useRegisterFcmToken: () => ({ register: mockRegister }),
}))

vi.mock('./app/firebase', () => ({
  auth: {},
}))

vi.mock('./routes', () => ({
  AppRouter: () => <div data-testid="app-router" />,
}))

vi.mock('./hooks/useOwnDispatches', () => ({
  useOwnDispatches: () => ({ groups: { active: [], pending: [] }, rows: [], error: null }),
}))

vi.mock('./hooks/useResponderTelemetry', () => ({
  useResponderTelemetry: () => null,
}))

vi.mock('./components/VersionGate', () => ({
  VersionGate: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock('./components/PrivacyNoticeModal', () => ({
  PrivacyNoticeModal: () => null,
}))

describe('FcmSetup', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('VITE_FIREBASE_API_KEY', 'test-api-key')
    vi.stubEnv('VITE_FIREBASE_AUTH_DOMAIN', 'test.firebaseapp.com')
    vi.stubEnv('VITE_FIREBASE_PROJECT_ID', 'test-project')
    vi.stubEnv('VITE_FIREBASE_STORAGE_BUCKET', 'test-bucket.appspot.com')
    vi.stubEnv('VITE_FIREBASE_MESSAGING_SENDER_ID', '123456789')
    vi.stubEnv('VITE_FIREBASE_APP_ID', '1:123:web:test')
    mockRegister.mockResolvedValue(undefined)
    Object.defineProperty(globalThis, 'navigator', {
      value: {
        serviceWorker: {
          register: vi.fn(),
        },
      },
      writable: true,
      configurable: true,
    })
  })

  it('registers SW and posts config on web when worker is active', async () => {
    const postMessage = vi.fn()
    const mockRegistration = {
      active: { postMessage } as unknown as ServiceWorker,
      installing: null,
      waiting: null,
    } as unknown as ServiceWorkerRegistration

    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(false)
    vi.mocked(navigator.serviceWorker.register).mockResolvedValue(mockRegistration)

    render(<FcmSetup />)
    await vi.waitFor(() => {
      expect(navigator.serviceWorker.register).toHaveBeenCalledWith('/firebase-messaging-sw.js')
      expect(postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'FIREBASE_CONFIG',
          config: expect.objectContaining({
            apiKey: expect.any(String),
            authDomain: expect.any(String),
            projectId: expect.any(String),
            storageBucket: expect.any(String),
            messagingSenderId: expect.any(String),
            appId: expect.any(String),
          }),
        }),
      )
      expect(mockRegister).toHaveBeenCalled()
    })
  })

  it('waits for installing worker to activate before posting config and calling register', async () => {
    const postMessage = vi.fn()
    let stateChangeHandler: ((event: Event) => void) | null = null
    const mockWorker = {
      addEventListener: (_event: string, handler: (event: Event) => void) => {
        stateChangeHandler = handler
      },
      postMessage,
      state: 'installing',
    } as unknown as ServiceWorker

    const mockRegistration = {
      active: null,
      installing: mockWorker,
      waiting: null,
    } as unknown as ServiceWorkerRegistration

    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(false)
    vi.mocked(navigator.serviceWorker.register).mockResolvedValue(mockRegistration)

    render(<FcmSetup />)

    await vi.waitFor(() => {
      expect(stateChangeHandler).not.toBeNull()
    })

    // Before activation, register should NOT be called
    expect(mockRegister).not.toHaveBeenCalled()

    // Simulate activation
    Object.defineProperty(mockWorker, 'state', { value: 'activated', writable: true })
    Object.defineProperty(mockRegistration, 'active', {
      value: { postMessage },
      writable: true,
    })
    const handler = stateChangeHandler as ((event: Event) => void) | null
    if (handler != null) {
      handler({ target: mockWorker } as unknown as Event)
    }

    await vi.waitFor(() => {
      expect(postMessage).toHaveBeenCalledWith(expect.objectContaining({ type: 'FIREBASE_CONFIG' }))
      expect(mockRegister).toHaveBeenCalled()
    })
  })

  it('waits for updatefound worker to activate before calling register', async () => {
    const postMessage = vi.fn()
    let updatefoundHandler: (() => void) | null = null
    let stateChangeHandler: ((event: Event) => void) | null = null

    const mockWorker = {
      addEventListener: (_event: string, handler: (event: Event) => void) => {
        stateChangeHandler = handler
      },
      postMessage,
      state: 'installing',
    } as unknown as ServiceWorker

    const mockRegistration = {
      active: null,
      installing: null,
      waiting: null,
      addEventListener: (_event: string, handler: () => void) => {
        updatefoundHandler = handler
      },
    } as unknown as ServiceWorkerRegistration

    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(false)
    vi.mocked(navigator.serviceWorker.register).mockResolvedValue(mockRegistration)

    render(<FcmSetup />)

    await vi.waitFor(() => {
      expect(updatefoundHandler).not.toBeNull()
    })

    // Before updatefound, register should NOT be called
    expect(mockRegister).not.toHaveBeenCalled()

    // Simulate updatefound
    const ufHandler = updatefoundHandler as (() => void) | null
    if (ufHandler != null) {
      Object.defineProperty(mockRegistration, 'installing', {
        value: mockWorker,
        writable: true,
      })
      ufHandler()
    }

    await vi.waitFor(() => {
      expect(stateChangeHandler).not.toBeNull()
    })

    // Before activation, register should NOT be called
    expect(mockRegister).not.toHaveBeenCalled()

    // Simulate activation
    Object.defineProperty(mockWorker, 'state', { value: 'activated', writable: true })
    Object.defineProperty(mockRegistration, 'active', {
      value: { postMessage },
      writable: true,
    })
    const scHandler = stateChangeHandler as ((event: Event) => void) | null
    if (scHandler != null) {
      scHandler({ target: mockWorker } as unknown as Event)
    }

    await vi.waitFor(() => {
      expect(postMessage).toHaveBeenCalledWith(expect.objectContaining({ type: 'FIREBASE_CONFIG' }))
      expect(mockRegister).toHaveBeenCalled()
    })
  })

  it('calls register() directly on native platforms', async () => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true)

    render(<FcmSetup />)

    await vi.waitFor(() => {
      expect(mockRegister).toHaveBeenCalled()
      expect(navigator.serviceWorker.register).not.toHaveBeenCalled()
    })
  })

  it('does nothing when user is null', async () => {
    currentUser = null

    render(<FcmSetup />)

    // Wait a tick to ensure useEffect ran
    await new Promise((resolve) => setTimeout(resolve, 10))

    expect(mockRegister).not.toHaveBeenCalled()
    expect(navigator.serviceWorker.register).not.toHaveBeenCalled()

    // Restore user for other tests
    currentUser = mockUser
  })

  it('warns when SW registration fails', async () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(false)
    vi.mocked(navigator.serviceWorker.register).mockRejectedValue(new Error('SW failed'))

    render(<FcmSetup />)

    await vi.waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith('SW registration failed:', expect.any(Error))
    })

    consoleSpy.mockRestore()
  })

  it('warns when a required Firebase config field is missing', async () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const postMessage = vi.fn()
    const mockRegistration = {
      active: { postMessage } as unknown as ServiceWorker,
      installing: null,
      waiting: null,
    } as unknown as ServiceWorkerRegistration

    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(false)
    vi.mocked(navigator.serviceWorker.register).mockResolvedValue(mockRegistration)

    // Temporarily remove a required env var
    vi.stubEnv('VITE_FIREBASE_API_KEY', '')

    render(<FcmSetup />)

    await vi.waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Missing Firebase config field'),
      )
      expect(postMessage).not.toHaveBeenCalled()
      expect(mockRegister).not.toHaveBeenCalled()
    })

    consoleSpy.mockRestore()
  })
})
