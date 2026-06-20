/* eslint-disable @typescript-eslint/no-empty-function */
import '@testing-library/jest-dom/vitest'
import { beforeEach, describe, it, expect, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

const {
  mockOnAuthStateChanged,
  mockUseMyActiveReports,
  mockCancelReport,
  mockDeleteReport,
  mockToast,
} = vi.hoisted(() => ({
  mockOnAuthStateChanged: vi.fn(),
  mockUseMyActiveReports: vi.fn(),
  mockCancelReport: vi.fn().mockResolvedValue(undefined),
  mockDeleteReport: vi.fn().mockResolvedValue(undefined),
  mockToast: vi.fn(),
}))

vi.mock('firebase/auth', () => ({
  onAuthStateChanged: (...args: unknown[]) => mockOnAuthStateChanged(...args),
  signOut: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../services/firebase.js', () => ({
  auth: () => ({}),
  hasFirebaseConfig: () => true,
}))

vi.mock('../hooks/useMyActiveReports.js', () => ({
  useMyActiveReports: () => mockUseMyActiveReports(),
}))

vi.mock('../services/callables.js', () => ({
  cancelReport: (...args: unknown[]) => mockCancelReport(...args),
}))

vi.mock('../services/localForageReports.js', () => ({
  deleteReport: (...args: unknown[]) => mockDeleteReport(...args),
}))

vi.mock('../hooks/useToast.js', () => ({
  useToast: () => ({ toast: mockToast }),
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

const activeReport = {
  publicRef: 'ref-1',
  reportType: 'flood',
  severity: 'medium',
  lat: 14.1,
  lng: 122.9,
  submittedAt: 1713350400000,
  status: 'awaiting_verify',
  id: 'report-1',
} as const

function setupRegisteredUser() {
  mockOnAuthStateChanged.mockImplementation((_auth: unknown, cb: (u: unknown) => void) => {
    cb({ isAnonymous: false, uid: 'reg123', displayName: 'Juan' })
    return () => {}
  })
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
    setupRegisteredUser()
    renderProfileTab()
    expect(screen.getByText('Juan')).toBeInTheDocument()
    expect(screen.getByLabelText('Settings')).toBeInTheDocument()
  })

  it('shows report list for registered user', () => {
    setupRegisteredUser()
    renderProfileTab()
    expect(screen.getByText('No reports yet')).toBeInTheDocument()
  })

  it('opens a report card at its Response Thread route', () => {
    setupRegisteredUser()
    mockUseMyActiveReports.mockReturnValue({
      loading: false,
      reports: [activeReport],
    })

    render(
      <MemoryRouter initialEntries={['/profile']}>
        <Routes>
          <Route path="/profile" element={<ProfileTab />} />
          <Route path="/track/:id" element={<div>Response thread destination</div>} />
        </Routes>
      </MemoryRouter>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Track' }))
    expect(screen.getByText('Response thread destination')).toBeInTheDocument()
  })

  it('shows a retryable error instead of the empty report list when report loading fails', () => {
    const retryReports = vi.fn()
    setupRegisteredUser()
    mockUseMyActiveReports.mockReturnValue({
      loading: false,
      reports: [],
      status: 'error',
      error: "We can't load your reports right now",
      retry: retryReports,
    })

    renderProfileTab()

    expect(screen.getByRole('alert')).toHaveTextContent("We can't load your reports right now")
    expect(screen.queryByText('No reports yet')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /retry/i }))

    expect(retryReports).toHaveBeenCalledOnce()
  })

  it('shows a withdraw action for unverified reports in the profile report list', () => {
    setupRegisteredUser()
    mockUseMyActiveReports.mockReturnValue({
      loading: false,
      reports: [activeReport],
    })

    renderProfileTab()

    expect(screen.getByRole('button', { name: /withdraw report ref-1/i })).toBeInTheDocument()
  })

  it('shows success toast when withdrawing a report from the profile tab', async () => {
    setupRegisteredUser()
    mockUseMyActiveReports.mockReturnValue({
      loading: false,
      reports: [activeReport],
    })

    renderProfileTab()

    // Click the withdraw button
    const withdrawBtn = screen.getByRole('button', { name: /withdraw report ref-1/i })
    fireEvent.click(withdrawBtn)

    // Wait for DeleteSheet to appear and click confirm
    await waitFor(() => {
      expect(screen.getByRole('alertdialog')).toBeInTheDocument()
    })
    const confirmBtn = screen.getByRole('button', { name: 'Withdraw Report' })
    await act(async () => {
      fireEvent.click(confirmBtn)
      await Promise.resolve()
    })

    // Verify backend called and toast shown
    await waitFor(() => {
      expect(mockCancelReport).toHaveBeenCalledWith('report-1')
      expect(mockDeleteReport).toHaveBeenCalledWith('ref-1')
    })
    expect(mockToast).toHaveBeenCalledWith(
      'Your report was withdrawn and is no longer active.',
      'success',
    )
  })

  it('shows impact path progress from real report statuses', () => {
    setupRegisteredUser()
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
    setupRegisteredUser()
    renderProfileTab()
    expect(screen.getByText('Sign out')).toBeInTheDocument()
  })
})
