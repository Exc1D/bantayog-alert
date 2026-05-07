import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const { mockInitiate, mockDeactivate, mockOnSnapshot } = vi.hoisted(() => ({
  mockInitiate: vi.fn(),
  mockDeactivate: vi.fn(),
  mockOnSnapshot: vi.fn(() => vi.fn()),
}))

vi.mock('../hooks/useBreakGlass', () => ({
  useBreakGlass: () => ({
    active: false,
    sessionId: null,
    expiresAt: null,
    error: null,
    loading: false,
    initiateSession: mockInitiate,
    deactivateSession: mockDeactivate,
  }),
}))

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  query: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
  onSnapshot: mockOnSnapshot,
}))

vi.mock('../app/firebase', () => ({ db: {} }))

import { BreakGlassPage } from '../pages/BreakGlassPage'

describe('BreakGlassPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    const impl = (_q: unknown, cb: (snap: unknown) => void) => {
      cb({ docs: [] })
      return vi.fn()
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument
    mockOnSnapshot.mockImplementation(impl as any)
  })

  it('renders purpose explanation', () => {
    render(<BreakGlassPage />)
    expect(
      screen.getByText(/break-glass access grants temporary full data access/i),
    ).toBeInTheDocument()
  })

  it('shows 72-hour expiry in explanation text', () => {
    render(<BreakGlassPage />)
    expect(screen.getByText(/72/)).toBeInTheDocument()
  })

  it('renders reason textarea', () => {
    render(<BreakGlassPage />)
    expect(screen.getByLabelText(/reason/i)).toBeInTheDocument()
  })

  it('renders TOTP verification input', () => {
    render(<BreakGlassPage />)
    expect(screen.getByLabelText(/totp/i)).toBeInTheDocument()
  })

  it('disables Activate button when reason is fewer than 50 characters', async () => {
    const user = userEvent.setup()
    render(<BreakGlassPage />)
    const reasonInput = screen.getByLabelText(/reason/i)
    await user.type(reasonInput, 'Too short')
    const btn = screen.getByRole('button', { name: /activate break-glass/i })
    expect(btn).toBeDisabled()
  })

  it('enables Activate button when reason is 50+ characters and TOTP is 6 digits', async () => {
    const user = userEvent.setup()
    render(<BreakGlassPage />)
    const reasonInput = screen.getByLabelText(/reason/i)
    await user.type(
      reasonInput,
      'This is a sufficiently detailed reason for accessing break-glass.',
    )
    const totpInput = screen.getByLabelText(/totp/i)
    await user.type(totpInput, '123456')
    const btn = screen.getByRole('button', { name: /activate break-glass/i })
    expect(btn).not.toBeDisabled()
  })

  it('renders audit log table heading', () => {
    render(<BreakGlassPage />)
    expect(screen.getByText(/past sessions/i)).toBeInTheDocument()
  })

  it('renders empty audit log message when no past sessions', async () => {
    render(<BreakGlassPage />)
    expect(await screen.findByText(/no past break-glass sessions/i)).toBeInTheDocument()
  })

  it('renders past session rows from Firestore', async () => {
    const now = Date.now()
    const impl2 = (_q: unknown, cb: (snap: unknown) => void) => {
      cb({
        docs: [
          {
            id: 'session-1',
            data: () => ({
              uid: 'admin-1',
              reason: 'Emergency data access required for incident response',
              startedAt: { toMillis: () => now - 86400000 },
              expiresAt: { toMillis: () => now - 82800000 },
            }),
          },
        ],
      })
      return vi.fn()
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument
    mockOnSnapshot.mockImplementation(impl2 as any)
    render(<BreakGlassPage />)
    expect(await screen.findByText(/admin-1/i)).toBeInTheDocument()
  })
})
