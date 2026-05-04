/* eslint-disable @typescript-eslint/no-empty-function */
import '@testing-library/jest-dom/vitest'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

const mockOnAuthStateChanged = vi.fn()

vi.mock('firebase/auth', () => ({
  onAuthStateChanged: (...args: unknown[]) => mockOnAuthStateChanged(...args),
}))

vi.mock('../services/firebase.js', () => ({
  auth: () => ({}),
  hasFirebaseConfig: () => true,
}))

vi.mock('../hooks/useMyActiveReports.js', () => ({
  useMyActiveReports: () => ({ reports: [], loading: false }),
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

  it('shows sign out button for registered user', () => {
    mockOnAuthStateChanged.mockImplementation((_auth: unknown, cb: (u: unknown) => void) => {
      cb({ isAnonymous: false, uid: 'reg123' })
      return () => {}
    })
    renderProfileTab()
    expect(screen.getByText('Sign out')).toBeInTheDocument()
  })
})
