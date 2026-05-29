import { describe, it, expect, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import MapPage from '../pages/MapPage'

vi.mock('../hooks/useFirestoreListeners', () => ({
  useFirestoreListeners: () => ({
    loading: false,
    error: null,
    reports: [],
    reportOps: [],
    alerts: [],
    responders: [],
  }),
}))

vi.mock('../providers/WindowSyncProvider', () => ({
  useWindowSyncContext: () => ({
    sendSync: vi.fn(),
    subscribe: vi.fn().mockReturnValue(() => {
      /* unsubscribe */
    }),
  }),
}))

describe('MapPage', () => {
  it('renders header and map', () => {
    render(
      <MemoryRouter>
        <MapPage />
      </MemoryRouter>,
    )
    expect(screen.getByText('PDRRMO Camarines Norte')).toBeInTheDocument()
  })

  it('opens alert declaration from the map header', () => {
    render(
      <MemoryRouter>
        <MapPage />
      </MemoryRouter>,
    )
    fireEvent.click(screen.getByRole('button', { name: /declare alert/i }))
    expect(screen.getByRole('dialog', { name: /declare alert/i })).toBeInTheDocument()
  })
})
