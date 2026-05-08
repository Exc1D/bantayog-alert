import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { IncidentFeed, type IncidentFeedItem } from '../components/IncidentFeed'

vi.mock('../components/AnimatedIncidentCard', () => ({
  AnimatedIncidentCard: ({ incident, index }: { incident: IncidentFeedItem; index: number }) => (
    <div data-testid="incident-item" data-index={index}>
      <span>{incident.type}</span>
      <span>{incident.municipality}</span>
      <span>{incident.status}</span>
    </div>
  ),
}))

const mockCriticalIncident: IncidentFeedItem = {
  id: 'inc-1',
  location: { lat: 14.1, lng: 122.8 },
  severity: 'critical',
  type: 'Flood',
  municipality: 'Daet',
  timestamp: new Date('2026-05-08T14:30:00Z'),
  status: 'active',
}

const mockHighIncident: IncidentFeedItem = {
  id: 'inc-2',
  location: { lat: 14.2, lng: 122.9 },
  severity: 'high',
  type: 'Landslide',
  municipality: 'Labo',
  timestamp: new Date('2026-05-08T14:25:00Z'),
  status: 'active',
}

const mockMediumIncident: IncidentFeedItem = {
  id: 'inc-3',
  location: { lat: 14.0, lng: 122.7 },
  severity: 'medium',
  type: 'Road Block',
  municipality: 'Vinzons',
  timestamp: new Date('2026-05-08T14:20:00Z'),
  status: 'active',
}

const mockIncidents: IncidentFeedItem[] = [
  mockCriticalIncident,
  mockHighIncident,
  mockMediumIncident,
]

describe('IncidentFeed', () => {
  afterEach(() => {
    cleanup()
  })

  afterEach(() => {
    cleanup()
  })

  it('renders empty state when no incidents', () => {
    render(<IncidentFeed incidents={[]} onTriage={vi.fn()} onDispatch={vi.fn()} onView={vi.fn()} />)

    expect(screen.getByText('Active Incidents')).toBeInTheDocument()
    expect(screen.getByText('0')).toBeInTheDocument()
    expect(screen.getByText(/No active incidents/i)).toBeInTheDocument()
  })

  it('renders incident count in header', () => {
    render(
      <IncidentFeed
        incidents={mockIncidents}
        onTriage={vi.fn()}
        onDispatch={vi.fn()}
        onView={vi.fn()}
      />,
    )

    expect(screen.getByText('Active Incidents')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('renders all incident items', () => {
    render(
      <IncidentFeed
        incidents={mockIncidents}
        onTriage={vi.fn()}
        onDispatch={vi.fn()}
        onView={vi.fn()}
      />,
    )

    mockIncidents.forEach((incident) => {
      expect(screen.getByText(incident.type)).toBeInTheDocument()
      expect(screen.getByText(new RegExp(incident.municipality))).toBeInTheDocument()
    })
  })

  it('sorts incidents by timestamp newest first', () => {
    render(
      <IncidentFeed
        incidents={mockIncidents}
        onTriage={vi.fn()}
        onDispatch={vi.fn()}
        onView={vi.fn()}
      />,
    )

    const items = screen.getAllByTestId('incident-item')
    expect(items).toHaveLength(3)
    expect(items[0]).toHaveTextContent('Flood')
    expect(items[1]).toHaveTextContent('Landslide')
    expect(items[2]).toHaveTextContent('Road Block')
  })
})
