import { describe, it, expect, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

const profileState = vi.hoisted(() => ({
  profile: null as null | {
    displayName?: string
    responderType?: string
    stationLabel?: string
  },
}))

vi.mock('../app/firebase', () => ({
  auth: { currentUser: { uid: 'uid-1', displayName: 'BFP Test Responder 01' } },
  db: {},
}))

vi.mock('@bantayog/shared-ui', () => ({
  useAuth: () => ({ user: { uid: 'uid-1' }, signOut: vi.fn() }),
}))

vi.mock('../hooks/useResponderProfile', () => ({
  useResponderProfile: () => ({ profile: profileState.profile }),
}))

vi.mock('../hooks/useResponderAvailability', () => ({
  useResponderAvailability: () => ({ status: 'available', setAvailability: vi.fn() }),
}))

vi.mock('../hooks/useDispatchHistory', () => ({
  useDispatchHistory: () => ({ history: [], loading: false, error: null }),
}))

import { ProfilePage } from './ProfilePage'

describe('ProfilePage', () => {
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
})
