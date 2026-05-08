import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { ProvincialMap } from '../components/ProvincialMap'

// Mock react-leaflet
vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="map-container">{children}</div>
  ),
  TileLayer: () => <div data-testid="tile-layer" />,
  GeoJSON: ({ data }: { data: unknown }) => (
    <div data-testid="geojson" data-features={JSON.stringify(data)} />
  ),
  Marker: ({ position }: { position: [number, number] }) => (
    <div data-testid="marker" data-position={JSON.stringify(position)} />
  ),
  Popup: ({ children }: { children: React.ReactNode }) => <div data-testid="popup">{children}</div>,
  useMap: () => ({
    fitBounds: vi.fn(),
    flyTo: vi.fn(),
    setView: vi.fn(),
  }),
}))

// Mock leaflet
vi.mock('leaflet', () => ({
  default: {
    geoJSON: vi.fn(() => ({
      getBounds: vi.fn(() => ({
        extend: vi.fn(),
      })),
    })),
    latLngBounds: vi.fn(() => ({
      extend: vi.fn(),
    })),
  },
}))

import type { Incident } from './ProvincialMap'

const mockIncidents: Incident[] = [
  {
    id: '1',
    location: { lat: 14.1, lng: 122.9 },
    severity: 'critical',
    type: 'Flood',
    municipality: 'Daet',
  },
  {
    id: '2',
    location: { lat: 14.2, lng: 122.8 },
    severity: 'medium',
    type: 'Landslide',
    municipality: 'Labo',
  },
]

import type { MunicipalityData } from './MunicipalGrid'

const mockMunicipalities: MunicipalityData[] = [
  { name: 'Daet', activeIncidents: 3, avgResponseTimeMinutes: 12, status: 'slow' },
  { name: 'Labo', activeIncidents: 5, avgResponseTimeMinutes: 25, status: 'delayed' },
]

describe('ProvincialMap', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  it('renders map container', () => {
    render(
      <ProvincialMap
        incidents={mockIncidents}
        municipalities={mockMunicipalities}
        selectedMunicipality={null}
      />,
    )

    expect(screen.getByTestId('map-container')).toBeInTheDocument()
  })

  it('renders tile layer', () => {
    render(
      <ProvincialMap
        incidents={mockIncidents}
        municipalities={mockMunicipalities}
        selectedMunicipality={null}
      />,
    )

    expect(screen.getByTestId('tile-layer')).toBeInTheDocument()
  })

  it('renders incident markers', () => {
    render(
      <ProvincialMap
        incidents={mockIncidents}
        municipalities={mockMunicipalities}
        selectedMunicipality={null}
      />,
    )

    const markers = screen.getAllByTestId('marker')
    expect(markers.length).toBe(mockIncidents.length)
  })

  it('renders geojson for municipalities', () => {
    render(
      <ProvincialMap
        incidents={mockIncidents}
        municipalities={mockMunicipalities}
        selectedMunicipality={null}
      />,
    )

    expect(screen.getByTestId('geojson')).toBeInTheDocument()
  })

  it('displays legend', () => {
    render(
      <ProvincialMap
        incidents={mockIncidents}
        municipalities={mockMunicipalities}
        selectedMunicipality={null}
      />,
    )

    expect(screen.getByText('Legend')).toBeInTheDocument()
    expect(screen.getByText('Critical')).toBeInTheDocument()
    expect(screen.getByText('Medium')).toBeInTheDocument()
    expect(screen.getByText('Low')).toBeInTheDocument()
  })

  it('renders without incidents', () => {
    render(
      <ProvincialMap
        incidents={[]}
        municipalities={mockMunicipalities}
        selectedMunicipality={null}
      />,
    )

    expect(screen.getByTestId('map-container')).toBeInTheDocument()
    expect(screen.queryAllByTestId('marker').length).toBe(0)
  })

  it('shows empty state overlay when no incidents', () => {
    render(
      <ProvincialMap
        incidents={[]}
        municipalities={mockMunicipalities}
        selectedMunicipality={null}
      />,
    )

    expect(screen.getByText('No active incidents')).toBeInTheDocument()
    expect(screen.getByTestId('empty-state-overlay')).toBeInTheDocument()
  })

  it('does not show empty state when incidents exist', () => {
    render(
      <ProvincialMap
        incidents={mockIncidents}
        municipalities={mockMunicipalities}
        selectedMunicipality={null}
      />,
    )

    expect(screen.queryByTestId('empty-state-overlay')).not.toBeInTheDocument()
  })
})
