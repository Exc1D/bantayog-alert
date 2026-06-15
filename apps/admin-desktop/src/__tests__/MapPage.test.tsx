import { describe, it, expect, vi, afterEach } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import MapPage from '../pages/MapPage'
import { useCommandCenterStore } from '../stores/commandCenterStore'

vi.mock('../app/firebase', () => ({
  db: {} as never,
  getFirestoreInstance: () => ({}) as never,
  auth: {} as never,
  functions: {} as never,
  rtdb: {} as never,
  firebaseApp: {} as never,
}))

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

const syncCtl = vi.hoisted(() => ({
  handler: null as ((msg: unknown) => void) | null,
}))

vi.mock('../providers/WindowSyncProvider', () => ({
  useWindowSyncContext: () => ({
    sendSync: vi.fn(),
    subscribe: (h: (msg: unknown) => void) => {
      syncCtl.handler = h
      return (): void => {
        return
      }
    },
  }),
}))

describe('MapPage', () => {
  afterEach(() => {
    syncCtl.handler = null
    useCommandCenterStore.setState({ selectedMunicipalityId: null, selectedReportId: null })
  })

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

  it('N6 receiver: cross-window select:municipality message selects municipality in store', () => {
    useCommandCenterStore.setState({ selectedMunicipalityId: null })
    render(
      <MemoryRouter>
        <MapPage />
      </MemoryRouter>,
    )
    act(() => {
      syncCtl.handler?.({
        type: 'select:municipality',
        municipalityId: 'daet',
        source: 'dashboard',
      })
    })
    expect(useCommandCenterStore.getState().selectedMunicipalityId).toBe('daet')
  })
})
