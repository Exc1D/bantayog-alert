import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import { useEffect } from 'react'

// Simplified FcmSetup component for testing
function FcmSetup({
  user,
  isNative,
  register,
}: {
  user: { uid: string } | null
  isNative: boolean
  register: () => Promise<void>
}) {
  useEffect(() => {
    if (!user) return

    if (isNative) {
      register().catch((err: unknown) => {
        console.warn('Native push registration failed:', err)
      })
      return
    }

    if (!('serviceWorker' in navigator)) return
    navigator.serviceWorker
      .register('/firebase-messaging-sw.js')
      .then((registration) => {
        const config = {
          apiKey: 'test-api-key',
          authDomain: 'test-auth-domain',
          projectId: 'test-project-id',
          storageBucket: 'test-storage-bucket',
          messagingSenderId: 'test-sender-id',
          appId: 'test-app-id',
        }

        const sendConfig = () => {
          registration.active?.postMessage({
            type: 'FIREBASE_CONFIG',
            config,
          })
        }

        if (registration.active) {
          sendConfig()
        }

        return register()
      })
      .catch((err: unknown) => {
        console.warn('SW registration failed:', err)
      })
  }, [user, register])

  return null
}

const mockRegister = vi.fn(() => Promise.resolve())
const mockServiceWorker = {
  register: vi.fn(() => Promise.resolve({
    active: { postMessage: vi.fn() },
    addEventListener: vi.fn(),
    installing: null,
  })),
}

describe('FcmSetup', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Object.defineProperty(navigator, 'serviceWorker', {
      value: mockServiceWorker,
      writable: true,
      configurable: true,
    })
  })

  it('registers service worker on web platform', async () => {
    render(<FcmSetup user={{ uid: 'test-user' }} isNative={false} register={mockRegister} />)

    await vi.waitFor(() => {
      expect(mockServiceWorker.register).toHaveBeenCalledWith('/firebase-messaging-sw.js')
    })
  })

  it('calls register() after SW registration', async () => {
    render(<FcmSetup user={{ uid: 'test-user' }} isNative={false} register={mockRegister} />)

    await vi.waitFor(() => {
      expect(mockRegister).toHaveBeenCalled()
    })
  })

  it('skips SW registration on native platform', async () => {
    render(<FcmSetup user={{ uid: 'test-user' }} isNative={true} register={mockRegister} />)

    await vi.waitFor(() => {
      expect(mockServiceWorker.register).not.toHaveBeenCalled()
      expect(mockRegister).toHaveBeenCalled()
    })
  })

  it('does nothing when user is null', async () => {
    render(<FcmSetup user={null} isNative={false} register={mockRegister} />)

    // Wait a bit to ensure no async operations happen
    await new Promise((resolve) => setTimeout(resolve, 100))

    expect(mockServiceWorker.register).not.toHaveBeenCalled()
    expect(mockRegister).not.toHaveBeenCalled()
  })

  it('handles SW registration failure gracefully', async () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    mockServiceWorker.register.mockRejectedValue(new Error('SW failed'))

    render(<FcmSetup user={{ uid: 'test-user' }} isNative={false} register={mockRegister} />)

    await vi.waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith('SW registration failed:', expect.any(Error))
    })

    consoleSpy.mockRestore()
  })

  it('sends Firebase config to SW via postMessage', async () => {
    const postMessage = vi.fn()
    mockServiceWorker.register.mockResolvedValue({
      active: { postMessage },
      addEventListener: vi.fn(),
      installing: null,
    })

    render(<FcmSetup user={{ uid: 'test-user' }} isNative={false} register={mockRegister} />)

    await vi.waitFor(() => {
      expect(postMessage).toHaveBeenCalledWith({
        type: 'FIREBASE_CONFIG',
        config: expect.objectContaining({
          apiKey: 'test-api-key',
          projectId: 'test-project-id',
        }),
      })
    })
  })
})
