import { describe, it, expect, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

const mockDivIcon = vi.hoisted(() => vi.fn(() => ({ _kind: 'divIcon' })))

vi.mock('@bantayog/shared-ui', () => ({ useAuth: () => ({ user: { uid: 'uid-1' } }) }))
vi.mock('../hooks/useOwnDispatches', () => ({
  useOwnDispatches: () => ({ groups: { active: [], pending: [] }, rows: [], error: null }),
}))
vi.mock('../hooks/useReport', () => ({
  useReport: () => ({ report: null, loading: false }),
}))
vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="map">{children}</div>
  ),
  TileLayer: () => null,
  Marker: () => null,
  Popup: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  useMap: () => ({ setView: vi.fn() }),
}))
vi.mock('leaflet', () => ({
  default: { divIcon: mockDivIcon, icon: vi.fn(() => ({})) },
  divIcon: mockDivIcon,
  icon: vi.fn(() => ({})),
}))

import { MapPage } from './MapPage'

describe('MapPage', () => {
  it('renders map container', () => {
    render(
      <MemoryRouter>
        <MapPage />
      </MemoryRouter>,
    )
    expect(screen.getByTestId('map')).toBeInTheDocument()
  })

  it('shows legend with "Your location" item', () => {
    render(
      <MemoryRouter>
        <MapPage />
      </MemoryRouter>,
    )
    expect(screen.getByText(/your location/i)).toBeInTheDocument()
  })

  it('builds markers with L.divIcon (offline-friendly) instead of remote-URL L.icon', () => {
    expect(mockDivIcon).toHaveBeenCalled()
  })
})
