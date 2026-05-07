import { describe, it, expect, vi, beforeEach } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

const profileState = vi.hoisted(() => ({
  profile: null as null | {
    displayName?: string
    responderType?: string
    stationLabel?: string
    specializations?: string[]
  },
}))

const mockSignOut = vi.hoisted(() => vi.fn(() => Promise.resolve()))
const mockSetAvailability = vi.hoisted(() => vi.fn())

vi.mock('../app/firebase', () => ({
  auth: { currentUser: { uid: 'uid-1', displayName: 'Test Responder' } },
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
  useDispatchHistory: () => ({ history: [], loading: false, error: null }),
}))

import { ProfilePage } from './ProfilePage'

describe('ProfilePage — Responder Type Badge', () => {
  beforeEach(() => {
    profileState.profile = null
    mockSignOut.mockClear()
    mockSetAvailability.mockClear()
  })

  it('shows "POL · Police Officer" badge when responderType is POL', () => {
    profileState.profile = { displayName: 'Juan Cruz', responderType: 'POL' }
    render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>,
    )
    expect(screen.getByText(/POL/)).toBeInTheDocument()
    expect(screen.getByText(/Police Officer/i)).toBeInTheDocument()
  })

  it('shows "MED · Medical/Paramedic" badge when responderType is MED', () => {
    profileState.profile = { displayName: 'Ana Garcia', responderType: 'MED' }
    render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>,
    )
    expect(screen.getByText(/MED/)).toBeInTheDocument()
    expect(screen.getByText(/Medical\/Paramedic/i)).toBeInTheDocument()
  })

  it('shows "FIR · Firefighter" badge when responderType is FIR', () => {
    profileState.profile = { displayName: 'Pedro Santos', responderType: 'FIR' }
    render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>,
    )
    expect(screen.getByText(/FIR/)).toBeInTheDocument()
    expect(screen.getByText(/Firefighter/i)).toBeInTheDocument()
  })
})

describe('ProfilePage — Specialization Tags', () => {
  beforeEach(() => {
    profileState.profile = null
    mockSignOut.mockClear()
  })

  it('shows specialization chips when specializations array is non-empty', () => {
    profileState.profile = {
      displayName: 'Test Responder',
      responderType: 'MED',
      specializations: ['Basic Life Support', 'Water Rescue'],
    }
    render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>,
    )
    expect(screen.getByText('Basic Life Support')).toBeInTheDocument()
    expect(screen.getByText('Water Rescue')).toBeInTheDocument()
  })

  it('shows empty state message when specializations is an empty array', () => {
    profileState.profile = {
      displayName: 'Test Responder',
      responderType: 'GEN',
      specializations: [],
    }
    render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>,
    )
    expect(screen.getByText(/no specialization tags/i)).toBeInTheDocument()
    expect(screen.getByText(/contact your agency admin/i)).toBeInTheDocument()
  })

  it('shows empty state when specializations is undefined', () => {
    profileState.profile = {
      displayName: 'Test Responder',
      responderType: 'GEN',
    }
    render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>,
    )
    expect(screen.getByText(/no specialization tags/i)).toBeInTheDocument()
  })
})
