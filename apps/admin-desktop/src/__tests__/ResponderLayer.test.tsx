import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { MapContainer } from 'react-leaflet'
import { ResponderLayer } from '../components/ResponderLayer'
import type { Responder } from '../types'

const mockResponders: Responder[] = [
  {
    id: 'res1',
    name: 'Santos',
    agency: 'BFP Daet',
    status: 'EN_ROUTE',
    latitude: 14.12,
    longitude: 122.92,
    lastSeenAt: '2024-01-15T14:02:00Z',
  },
  {
    id: 'res2',
    name: 'Reyes',
    agency: 'PNP Labo',
    status: 'ON_SCENE',
    latitude: 14.05,
    longitude: 122.8,
    lastSeenAt: '2024-01-15T14:05:00Z',
  },
]

function renderLayer(responders: Responder[] = mockResponders) {
  return render(
    <MapContainer center={[14.1, 122.9]} zoom={10} style={{ height: 400 }}>
      <ResponderLayer responders={responders} />
    </MapContainer>,
  )
}

describe('ResponderLayer', () => {
  it('renders without crashing', () => {
    renderLayer()
    expect(document.querySelector('.leaflet-container')).toBeInTheDocument()
  })

  it('renders with empty responders array', () => {
    renderLayer([])
    expect(document.querySelector('.leaflet-container')).toBeInTheDocument()
  })

  it('renders with responders missing coordinates', () => {
    const incomplete = [
      {
        id: 'res3',
        name: 'NoCoords',
        agency: 'BFP',
        status: 'STANDBY' as const,
      },
    ]
    renderLayer(incomplete)
    expect(document.querySelector('.leaflet-container')).toBeInTheDocument()
  })

  it('renders with mixed valid and invalid coordinates', () => {
    const mixed: Responder[] = [
      mockResponders[0]!,
      {
        id: 'res4',
        name: 'MissingLatLng',
        agency: 'BFP',
        status: 'STANDBY',
      },
    ]
    renderLayer(mixed)
    expect(document.querySelector('.leaflet-container')).toBeInTheDocument()
  })
})
