/// <reference types="node" />
import { describe, it, expect, vi, beforeEach } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'

const mockAuthState = vi.hoisted(() => ({
  user: { uid: 'uid-1', email: 'responder@test.com' } as { uid: string; email: string } | null, // eslint-disable-line @typescript-eslint/no-unnecessary-type-assertion
  claims: { mfaEnrolled: false } as Record<string, unknown> | null, // eslint-disable-line @typescript-eslint/no-unnecessary-type-assertion
  loading: false,
}))

vi.mock('@bantayog/shared-ui', () => ({
  useAuth: () => mockAuthState,
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
    mockAuthState.user = { uid: 'uid-1', email: 'responder@test.com' }
    mockAuthState.claims = { mfaEnrolled: false }
    mockAuthState.loading = false
  })

  it('redirects to /totp-enroll when mfaEnrolled claim is false', () => {
    mockAuthState.claims = { mfaEnrolled: false }
    render(
      <MemoryRouter>
        <Routes>
          <Route
            path="/"
            element={
              <TotpGuard>
                <div data-testid="protected-content">Protected</div>
              </TotpGuard>
            }
          />
          <Route path="/totp-enroll" element={<div data-testid="totp-enroll-page">Enroll</div>} />
        </Routes>
      </MemoryRouter>,
    )
    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument()
    expect(screen.getByTestId('totp-enroll-page')).toBeInTheDocument()
  })

  it('renders children when mfaEnrolled claim is true', () => {
    mockAuthState.claims = { mfaEnrolled: true }
    renderGuard()
    expect(screen.getByTestId('protected-content')).toBeInTheDocument()
  })

  it('renders children when user is null (let ProtectedRoute handle auth)', () => {
    mockAuthState.user = null
    mockAuthState.claims = null
    renderGuard()
    expect(screen.getByTestId('protected-content')).toBeInTheDocument()
  })
})
