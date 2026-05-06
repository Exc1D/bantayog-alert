import { describe, it, expect, vi, beforeEach } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

const profileState = vi.hoisted(() => ({
  profile: null as null | {
    displayName?: string
    responderType?: string
    stationLabel?: string
  },
}))

const mockSignOut = vi.hoisted(() => vi.fn(() => Promise.resolve()))
const mockSetAvailability = vi.hoisted(() => vi.fn())

const historyState = vi.hoisted(() => ({
  history: [] as { status: string; dispatchId: string; reportId: string; dispatchedAt: number }[],
}))

vi.mock('../app/firebase', () => ({
  auth: { currentUser: { uid: 'uid-1', displayName: 'BFP Test Responder 01' } },
  db: {},
}))

vi.mock('@bantayog/shared-ui', () => ({
  useAuth: () => ({ user: { uid: 'uid-1' }, signOut: mockSignOut }),
}))

vi.mock('../hooks/useResponderProfile', () => ({
  useResponderProfile: () => ({ profile: profileState.profile }),
}))

vi.mock('../hooks/useResponderAvailability', () => ({
  useResponderAvailability: () => ({
    status: 'available',
    setAvailability: mockSetAvailability,
    writeError: null,
  }),
}))

vi.mock('../hooks/useDispatchHistory', () => ({
  useDispatchHistory: () => ({ history: historyState.history, loading: false, error: null }),
}))

import { ProfilePage } from './ProfilePage'

describe('ProfilePage', () => {
  beforeEach(() => {
    profileState.profile = null
    mockSignOut.mockClear()
    mockSetAvailability.mockClear()
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

  it('labels recent dispatch stats as "Recent Dispatches" rather than "Total Dispatches"', () => {
    profileState.profile = { responderType: 'fire' }
    render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>,
    )
    expect(screen.getByText(/Recent Dispatches/i)).toBeInTheDocument()
    expect(screen.queryByText(/^Total Dispatches$/i)).not.toBeInTheDocument()
  })

  it('requires a reason when setting non-available status', async () => {
    profileState.profile = { responderType: 'fire' }
    render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>,
    )

    const user = userEvent.setup()
    const select = screen.getByLabelText(/set availability status/i)
    await user.selectOptions(select, 'unavailable')

    const updateBtn = screen.getByRole('button', { name: /update status/i })
    await user.click(updateBtn)

    expect(screen.getByText(/reason is required/i)).toBeInTheDocument()
    expect(mockSetAvailability).not.toHaveBeenCalled()
  })

  it('calls signOut when the sign-out button is clicked', async () => {
    profileState.profile = { responderType: 'fire' }
    render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>,
    )

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /sign out/i }))

    expect(mockSignOut).toHaveBeenCalledTimes(1)
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
    expect(screen.getByText('2')).toBeInTheDocument()
  })
})
