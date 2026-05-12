/// <reference types="node" />
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TestWrapper } from './test-utils'

vi.mock('../services/firebase', () => ({
  auth: vi.fn(() => ({ currentUser: null })),
  db: {},
  fns: {},
  hasFirebaseConfig: vi.fn(() => false),
}))

vi.mock('../hooks/useReducedMotion', () => ({
  useReducedMotion: () => true, // skip animations
}))

vi.mock('../hooks/useSlotMachine', () => ({
  useSlotMachine: (code: string) => ({ display: code, done: true }),
}))

vi.mock('../hooks/useMunicipalityContact', () => ({
  useMunicipalityContact: () => ({
    label: 'Daet MDRRMO',
    hotline: '+63-054-440-1234',
  }),
}))

vi.mock('firebase/auth', () => ({
  onAuthStateChanged: vi.fn((_auth: unknown, cb: (u: null) => void) => {
    cb(null)
    return vi.fn()
  }),
}))

vi.mock('../components/ui/StatusBanner', () => ({
  StatusBanner: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock('../components/ui/Button', () => ({
  Button: ({
    children,
    onClick,
    variant,
    fullWidth,
  }: {
    children: React.ReactNode
    onClick?: () => void
    variant?: string
    fullWidth?: boolean
  }) => (
    <button
      type="button"
      onClick={onClick}
      data-variant={variant}
      data-fullwidth={String(fullWidth)}
    >
      {children}
    </button>
  ),
}))

vi.mock('../components/ui/FallbackCards', () => ({
  FallbackCards: ({
    onSmsClick,
  }: {
    hotlineNumber: string
    emphasized?: boolean
    onCallClick: () => void
    onSmsClick: () => void
  }) => (
    <div>
      <button type="button" onClick={onSmsClick}>
        Send as SMS
      </button>
    </div>
  ),
}))

vi.mock('../components/ui/Timeline', () => ({
  Timeline: () => null,
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('RevealSheet — queued state SMS fallback', () => {
  it('shows "Send as SMS" button in queued state', async () => {
    const { RevealSheet } = await import('../components/RevealSheet')
    render(
      <TestWrapper>
        <RevealSheet state="queued" referenceCode="BT-123456" />
      </TestWrapper>,
    )
    expect(screen.getByRole('button', { name: /send as sms/i })).toBeInTheDocument()
  })

  it('shows "Send as SMS" in failed_retryable state', async () => {
    const { RevealSheet } = await import('../components/RevealSheet')
    render(
      <TestWrapper>
        <RevealSheet state="failed_retryable" referenceCode="BT-123456" />
      </TestWrapper>,
    )
    expect(screen.getByRole('button', { name: /send as sms/i })).toBeInTheDocument()
  })

  it('sets window.location.href to sms: URL with hotline number on click', async () => {
    const assignSpy = vi.spyOn(window, 'location', 'get').mockReturnValue({
      href: '',
    } as unknown as Location)

    const { RevealSheet } = await import('../components/RevealSheet')
    render(
      <TestWrapper>
        <RevealSheet state="queued" referenceCode="BT-123456" />
      </TestWrapper>,
    )

    const btn = screen.getByRole('button', { name: /send as sms/i })
    btn.click()

    expect(window.location.href).toMatch(/^sms:\+630544401234/)
    expect(window.location.href).toContain('body=')
    expect(window.location.href).toContain('BANTAYOG%20BT-123456')
    expect(window.location.href).toContain('Add%20incident%20details')

    assignSpy.mockRestore()
  })
})
