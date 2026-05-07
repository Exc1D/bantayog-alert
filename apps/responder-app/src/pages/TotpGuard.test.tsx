/// <reference types="node" />
import { describe, it, expect, vi, beforeEach } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

const mockEnrolledFactors = vi.hoisted<{ factors: unknown[] }>(() => ({ factors: [] }))
const mockAuth = vi.hoisted<{ currentUser: { uid: string; email: string } | null }>(() => ({
  currentUser: { uid: 'uid-1', email: 'responder@test.com' },
}))

vi.mock('firebase/auth', () => ({
  multiFactor: () => ({
    enrolledFactors: mockEnrolledFactors.factors,
  }),
}))

vi.mock('../app/firebase', () => ({
  get auth() {
    return mockAuth
  },
}))

import { TotpGuard } from './TotpGuard'

function renderGuard(
  children: React.ReactNode = <div data-testid="protected-content">Protected</div>,
) {
  return render(
    <MemoryRouter>
      <TotpGuard>{children}</TotpGuard>
    </MemoryRouter>,
  )
}

describe('TotpGuard', () => {
  beforeEach(() => {
    mockEnrolledFactors.factors = []
    mockAuth.currentUser = { uid: 'uid-1', email: 'responder@test.com' }
  })

  it('redirects to /totp-enroll when user has no enrolled TOTP factors', () => {
    mockEnrolledFactors.factors = []
    renderGuard()
    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument()
  })

  it('renders children when user has at least one enrolled factor', () => {
    mockEnrolledFactors.factors = [
      { factorId: 'totp', uid: 'factor-1', displayName: 'Authenticator', enrollmentTime: '' },
    ]
    renderGuard()
    expect(screen.getByTestId('protected-content')).toBeInTheDocument()
  })

  it('renders children when auth.currentUser is null (let ProtectedRoute handle auth)', () => {
    mockAuth.currentUser = null
    mockEnrolledFactors.factors = []
    renderGuard()
    expect(screen.getByTestId('protected-content')).toBeInTheDocument()
  })
})
