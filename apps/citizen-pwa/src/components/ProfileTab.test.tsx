/* eslint-disable @typescript-eslint/no-empty-function */
import '@testing-library/jest-dom/vitest'
import { beforeEach, describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

const { mockOnAuthStateChanged, mockUseMyActiveReports } = vi.hoisted(() => ({
  mockOnAuthStateChanged: vi.fn(),
  mockUseMyActiveReports: vi.fn(),
}))

vi.mock('firebase/auth', () => ({
  onAuthStateChanged: (...args: unknown[]) => mockOnAuthStateChanged(...args),
}))

vi.mock('../services/firebase.js', () => ({
  auth: () => ({}),
  hasFirebaseConfig: () => true,
}))

vi.mock('../hooks/useMyActiveReports.js', () => ({
  useMyActiveReports: () => mockUseMyActiveReports(),
}))

vi.mock('./DeleteAccountFlow.js', () => ({
  DeleteAccountFlow: ({ onGoodbye }: { onGoodbye: () => void }) => (
    <button onClick={onGoodbye}>Delete Account</button>
  ),
}))

import { ProfileTab } from './ProfileTab'

function renderProfileTab() {
  return render(
    <MemoryRouter>
      <ProfileTab />
    </MemoryRouter>,
  )
}

describe('ProfileTab', () => {
  beforeEach(() => {
    mockOnAuthStateChanged.mockReset()
    mockUseMyActiveReports.mockReset()
    mockUseMyActiveReports.mockReturnValue({ reports: [], loading: false })
  })

  it('shows Guardian pitch card for pseudonymous user', () => {
    mockOnAuthStateChanged.mockImplementation((_auth: unknown, cb: (u: unknown) => void) => {
      cb({ isAnonymous: true, uid: 'anon123' })
      return () => {}
    })
    renderProfileTab()
    expect(screen.getByText('Become a Guardian')).toBeInTheDocument()
    expect(screen.getByText('Create account')).toBeInTheDocument()
  })

  it('shows settings gear for registered user', () => {
    mockOnAuthStateChanged.mockImplementation((_auth: unknown, cb: (u: unknown) => void) => {
      cb({ isAnonymous: false, uid: 'reg123', displayName: 'Juan' })
      return () => {}
    })
    renderProfileTab()
    expect(screen.getByText('Juan')).toBeInTheDocument()
    expect(screen.getByLabelText('Settings')).toBeInTheDocument()
  })

  it('shows report list for registered user', () => {
    mockOnAuthStateChanged.mockImplementation((_auth: unknown, cb: (u: unknown) => void) => {
      cb({ isAnonymous: false, uid: 'reg123', displayName: 'Juan' })
      return () => {}
    })
    renderProfileTab()
    expect(screen.getByText('No reports yet')).toBeInTheDocument()
  })

  it('shows impact path progress from real report statuses', () => {
    mockOnAuthStateChanged.mockImplementation((_auth: unknown, cb: (u: unknown) => void) => {
      cb({ isAnonymous: false, uid: 'reg123', displayName: 'Juan' })
      return () => {}
    })
    mockUseMyActiveReports.mockReturnValue({
      loading: false,
      reports: [
        {
          publicRef: 'ref-1',
          secret: 's1',
          reportType: 'flood',
          severity: 'medium',
          lat: 14.1,
          lng: 122.9,
          submittedAt: 1713350400000,
          status: 'awaiting_verify',
        },
        {
          publicRef: 'ref-2',
          secret: 's2',
          reportType: 'fire',
          severity: 'high',
          lat: 14.2,
          lng: 122.8,
          submittedAt: 1713350500000,
          status: 'verified',
        },
      ],
    })

    renderProfileTab()

    expect(screen.getByText('Impact Path')).toBeInTheDocument()
    expect(screen.getByText('3/4 signals')).toBeInTheDocument()
    expect(screen.getByText(/watch for responder updates/i)).toBeInTheDocument()
    expect(
      screen
        .getByText('Impact Path')
        .compareDocumentPosition(screen.getByText('Reports Submitted')),
    ).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
  })

  it('shows sign out button for registered user', () => {
    mockOnAuthStateChanged.mockImplementation((_auth: unknown, cb: (u: unknown) => void) => {
      cb({ isAnonymous: false, uid: 'reg123' })
      return () => {}
    })
    renderProfileTab()
    expect(screen.getByText('Sign out')).toBeInTheDocument()
  })
})
