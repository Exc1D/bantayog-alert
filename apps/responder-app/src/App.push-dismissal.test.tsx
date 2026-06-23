import '@testing-library/jest-dom/vitest'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const mockRegister = vi.hoisted(() => vi.fn())
const mockUser = vi.hoisted(() => ({ uid: 'responder-1' }))

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => false },
}))

vi.mock('@bantayog/shared-ui', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useAuth: () => ({ user: mockUser }),
  ProtectedRoute: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock('./hooks/useRegisterFcmToken', () => ({
  useRegisterFcmToken: () => ({ register: mockRegister }),
}))

vi.mock('./app/firebase', () => ({ auth: {} }))
vi.mock('./routes', () => ({ AppRouter: () => null }))
vi.mock('./hooks/useOwnDispatches', () => ({
  useOwnDispatches: () => ({ groups: { active: [], pending: [] } }),
}))
vi.mock('./hooks/useResponderTelemetry', () => ({ useResponderTelemetry: () => null }))
vi.mock('./components/VersionGate', () => ({
  VersionGate: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))
vi.mock('./components/PrivacyNoticeModal', () => ({ PrivacyNoticeModal: () => null }))

import { FcmSetup } from './App'

const dismissalKey = 'bantayog.responder.push-warning-dismissed:responder-1'

describe('FcmSetup push warning dismissal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    globalThis.localStorage.clear()
    globalThis.history.replaceState({}, '', '/')
    Object.defineProperty(globalThis, 'Notification', {
      value: { permission: 'denied' },
      writable: true,
      configurable: true,
    })
    Object.defineProperty(globalThis, 'navigator', {
      value: {},
      writable: true,
      configurable: true,
    })
  })

  it('persists dismissal and does not show the warning again after remount', async () => {
    const user = userEvent.setup()
    const firstRender = render(<FcmSetup />)

    expect(screen.getByText('Dispatch push notifications are blocked')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /dismiss/i }))

    expect(globalThis.localStorage.getItem(dismissalKey)).toBe('denied')
    expect(screen.queryByText('Dispatch push notifications are blocked')).not.toBeInTheDocument()

    firstRender.unmount()
    render(<FcmSetup />)

    expect(screen.queryByText('Dispatch push notifications are blocked')).not.toBeInTheDocument()
  })

  it('does not show the push warning during TOTP enrollment', () => {
    globalThis.history.replaceState({}, '', '/totp-enroll')

    render(<FcmSetup />)

    expect(screen.queryByText('Dispatch push notifications are blocked')).not.toBeInTheDocument()
  })
})
