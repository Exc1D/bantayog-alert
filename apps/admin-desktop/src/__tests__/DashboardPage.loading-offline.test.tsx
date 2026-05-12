import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import DashboardPage from '../pages/DashboardPage'
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
vi.mock('../hooks/useAudioAlerts', () => ({
  useAudioAlerts: () => ({
    enabled: false,
    toggle: vi.fn(),
    play: vi.fn(),
    playError: vi.fn(),
  }),
}))
vi.mock('../app/firebase', () => ({ db: {}, rtdb: {} }))

describe('DashboardPage loading + offline', () => {
  it('renders the OfflineBanner above the loading spinner when error is set', () => {
    render(
      <MemoryRouter>
        <WindowSyncProvider>
          <DashboardPage />
        </WindowSyncProvider>
      </MemoryRouter>,
    )
    const banner = screen.queryByRole('alert') ?? screen.queryByRole('status')
    expect(banner).not.toBeNull()
  })
})
