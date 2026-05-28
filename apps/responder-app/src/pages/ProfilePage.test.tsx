import { describe, it, expect, vi, beforeEach } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

const profileState = vi.hoisted(() => ({
  profile: null as null | {
    displayName?: string
    responderType?: string
    stationLabel?: string
    specializations?: string[]
  },
  loading: false,
  error: null as string | null,
}))

const mockSignOut = vi.hoisted(() => vi.fn(() => Promise.resolve()))
const mockSetAvailability = vi.hoisted(() => vi.fn())
const mockGetDoc = vi.hoisted(() => vi.fn())

const historyState = vi.hoisted(() => ({
  history: [] as {
    status: string
    dispatchId: string
    reportId: string
    dispatchedAt: number
    resolvedAt?: number
  }[],
  loading: false,
}))

vi.mock('../app/firebase', () => ({
  auth: { currentUser: { uid: 'uid-1', displayName: 'BFP Test Responder 01' } },
  db: {},
}))

vi.mock('@bantayog/shared-ui', () => ({
  useAuth: () => ({ user: { uid: 'uid-1' }, signOut: mockSignOut }),
}))

vi.mock('firebase/firestore', () => ({
  doc: vi.fn((_db, _collection, id: string) => ({ id })),
  getDoc: mockGetDoc,
}))

vi.mock('../hooks/useResponderProfile', () => ({
  useResponderProfile: () => ({
    profile: profileState.profile,
    loading: profileState.loading,
    error: profileState.error,
  }),
}))

vi.mock('../hooks/useResponderAvailability', () => ({
  useResponderAvailability: () => ({
    status: 'available',
    setAvailability: mockSetAvailability,
    writeError: null,
  }),
}))

vi.mock('../hooks/useDispatchHistory', () => ({
  useDispatchHistory: () => ({
    history: historyState.history,
    loading: historyState.loading,
    error: null,
  }),
}))

import { ProfilePage } from './ProfilePage'

describe('ProfilePage', () => {
  beforeEach(() => {
    profileState.profile = null
    profileState.loading = false
    profileState.error = null
    historyState.loading = false
    mockSignOut.mockClear()
    mockSetAvailability.mockClear()
    mockGetDoc.mockReset()
    mockGetDoc.mockResolvedValue({
      exists: () => false,
      data: () => ({}),
    })
    historyState.history = []
  })

  it('falls back to auth.currentUser.displayName when responders/{uid}.displayName is missing', () => {
    profileState.profile = { responderType: 'fire' }
    render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>,
    )
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('BFP Test Responder 01')
  })

  it('uses Firestore displayName when present', () => {
    profileState.profile = { displayName: 'Captain Garcia', responderType: 'fire' }
    render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>,
    )
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Captain Garcia')
  })

  it('labels recent dispatch stats as "Total Dispatches"', () => {
    profileState.profile = { responderType: 'fire' }
    render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>,
    )
    expect(screen.getByText(/Total Dispatches/i)).toBeInTheDocument()
    expect(screen.queryByText(/Recent Dispatches/i)).not.toBeInTheDocument()
  })

  it('requires a reason when setting non-available status', async () => {
    profileState.profile = { responderType: 'fire' }
    render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>,
    )

    const user = userEvent.setup()
    const unavailableBtn = screen.getByRole('button', { name: /unavailable/i })
    await user.click(unavailableBtn)

    const applyBtn = screen.getByRole('button', { name: /apply status/i })
    await user.click(applyBtn)

    expect(screen.getByText(/reason is required/i)).toBeInTheDocument()
    expect(mockSetAvailability).not.toHaveBeenCalled()
  })

  it('sets available status immediately via segmented control', async () => {
    profileState.profile = { responderType: 'fire' }
    render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>,
    )

    const user = userEvent.setup()
    const availableBtn = screen.getByRole('button', { name: /^available$/i })
    await user.click(availableBtn)

    expect(mockSetAvailability).toHaveBeenCalledWith('available')
    expect(screen.getByText(/status updated/i)).toBeInTheDocument()
  })

  it('calls signOut when the sign-out button is clicked after confirmation', async () => {
    const origConfirm = window.confirm
    window.confirm = vi.fn(() => true)
    profileState.profile = { responderType: 'fire' }
    render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>,
    )

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /sign out/i }))

    expect(window.confirm).toHaveBeenCalledWith('Are you sure you want to sign out?')
    expect(mockSignOut).toHaveBeenCalledTimes(1)
    window.confirm = origConfirm
  })

  it('does not call signOut when confirmation is cancelled', async () => {
    const origConfirm = window.confirm
    window.confirm = vi.fn(() => false)
    profileState.profile = { responderType: 'fire' }
    render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>,
    )

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /sign out/i }))

    expect(mockSignOut).not.toHaveBeenCalled()
    window.confirm = origConfirm
  })

  it('shows a loading state for profile when loading is true', () => {
    profileState.loading = true
    profileState.profile = null
    render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>,
    )

    expect(screen.getByText(/loading profile/i)).toBeInTheDocument()
  })

  it('shows N/A for dispatch stats while history is loading', () => {
    historyState.loading = true
    profileState.profile = { responderType: 'fire' }
    render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>,
    )

    const nas = screen.getAllByText('N/A')
    expect(nas.length).toBeGreaterThanOrEqual(1)
    historyState.loading = false
  })

  it('shows correct completion rate from dispatch history', () => {
    historyState.history = [
      { dispatchId: 'd-1', reportId: 'r-1', status: 'resolved', dispatchedAt: 1 },
      { dispatchId: 'd-2', reportId: 'r-2', status: 'resolved', dispatchedAt: 2 },
      { dispatchId: 'd-3', reportId: 'r-3', status: 'declined', dispatchedAt: 3 },
      { dispatchId: 'd-4', reportId: 'r-4', status: 'timed_out', dispatchedAt: 4 },
    ]
    profileState.profile = { responderType: 'fire' }

    render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>,
    )

    expect(screen.getByText('50%')).toBeInTheDocument()
    expect(screen.getByText(/Total Dispatches/i)).toBeInTheDocument()
  })

  it('renders the competence dashboard metrics from recent history', async () => {
    profileState.profile = {
      displayName: 'Captain Garcia',
      stationLabel: 'Daet Fire Station',
      responderType: 'FIR',
      specializations: ['Water Rescue', 'Structure Fire'],
    }
    historyState.history = [
      {
        dispatchId: 'd-1',
        reportId: 'r-flood',
        status: 'resolved',
        dispatchedAt: 1700000000000,
        resolvedAt: 1700000600000,
      },
      {
        dispatchId: 'd-2',
        reportId: 'r-fire',
        status: 'resolved',
        dispatchedAt: 1700086400000,
        resolvedAt: 1700087120000,
      },
      {
        dispatchId: 'd-3',
        reportId: 'r-flood',
        status: 'resolved',
        dispatchedAt: 1700172800000,
        resolvedAt: 1700173520000,
      },
      {
        dispatchId: 'd-4',
        reportId: 'r-med',
        status: 'declined',
        dispatchedAt: 1700259200000,
      },
    ]
    mockGetDoc.mockImplementation((ref: { id: string }) =>
      Promise.resolve({
        exists: () => true,
        data: () => ({
          reportType: ref.id === 'r-fire' ? 'fire' : ref.id === 'r-med' ? 'medical' : 'flood',
        }),
      }),
    )

    render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByText('4')).toBeInTheDocument()
      expect(screen.getByText('75%')).toBeInTheDocument()
      expect(screen.getByText('11m 20s')).toBeInTheDocument()
    })

    expect(screen.getByText(/water rescue/i)).toBeInTheDocument()
    expect(screen.getByText(/structure fire/i)).toBeInTheDocument()
    expect(screen.queryByText(/resolved by type/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/personal bests/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/longest availability streak/i)).not.toBeInTheDocument()
  })
})
