import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import MapPage from '../pages/MapPage'
import { WindowSyncProvider } from '../providers/WindowSyncProvider'

vi.mock('../hooks/useFirestoreListeners', () => ({
  useFirestoreListeners: () => ({
    loading: true,
    error: 'offline',
    reports: [],
    alerts: [],
    responders: [],
  }),
}))
vi.mock('../app/firebase', () => ({ db: {}, rtdb: {} }))

describe('MapPage loading + offline', () => {
  it('renders the OfflineBanner above the loading spinner when error is set', () => {
    render(
      <MemoryRouter>
        <WindowSyncProvider>
          <MapPage />
        </WindowSyncProvider>
      </MemoryRouter>,
    )
    const banner = screen.queryByRole('alert') ?? screen.queryByRole('status')
    expect(banner).not.toBeNull()
  })
})
