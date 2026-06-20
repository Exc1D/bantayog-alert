import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import type { PublicIncident, MyReport } from '../../MapTab/types.js'
import { NearbyCard, YourReportCard } from './SecondaryStack.js'

const report = {
  id: 'report-1',
  publicRef: 'ref-1234',
  reportType: 'flood',
  severity: 'high',
  lat: 14.112,
  lng: 122.956,
  submittedAt: 1_713_350_000_000,
  status: 'assigned',
  municipalityLabel: 'Daet',
} satisfies MyReport

const nearbyIncident = {
  id: 'incident-near',
  reportType: 'flood',
  severity: 'high',
  status: 'verified',
  barangayId: 'brgy-1',
  municipalityLabel: 'Daet',
  publicLocation: { lat: 14.115, lng: 122.958 },
  submittedAt: 1_713_349_000_000,
} satisfies PublicIncident

const fartherIncident = {
  ...nearbyIncident,
  id: 'incident-farther',
  reportType: 'fire',
  severity: 'medium',
  publicLocation: { lat: 14.18, lng: 122.99 },
} satisfies PublicIncident

describe('Home secondary stack modules', () => {
  it('renders the active report stage with a registry icon and links to the current tracking surface', () => {
    render(
      <MemoryRouter>
        <YourReportCard reports={[report]} />
      </MemoryRouter>,
    )

    const stage = screen.getByLabelText('Report status: Response coordinated')
    expect(within(stage).getByText('Response coordinated')).toBeInTheDocument()
    expect(stage.querySelector('svg')).not.toBeNull()
    expect(screen.getByRole('link', { name: /view report/i })).toHaveAttribute(
      'href',
      '/track/ref-1234',
    )
  })

  it('computes client-side nearby distance bands from a known user location', () => {
    render(
      <MemoryRouter>
        <NearbyCard
          error={null}
          incidents={[fartherIncident, nearbyIncident]}
          loading={false}
          userLocation={{ lat: 14.112, lng: 122.956 }}
        />
      </MemoryRouter>,
    )

    expect(screen.getByText('Within 1 km')).toBeInTheDocument()
    expect(screen.getByText('5-15 km away')).toBeInTheDocument()
    const severity = screen.getByLabelText('Nearby severity: HIGH')
    expect(within(severity).getByText('HIGH')).toBeInTheDocument()
    expect(severity.querySelector('svg')).not.toBeNull()
    expect(screen.getByRole('link', { name: /Flood/i })).toHaveAttribute(
      'href',
      '/map?municipality=Daet',
    )
  })

  it('keeps sibling modules visible when one module owns an error', () => {
    const retry = vi.fn()

    render(
      <MemoryRouter>
        <YourReportCard reports={[report]} />
        <NearbyCard
          error={new Error('permission denied')}
          incidents={[]}
          loading={false}
          onRetry={retry}
          userLocation={{ lat: 14.112, lng: 122.956 }}
        />
      </MemoryRouter>,
    )

    expect(screen.getByText('Response coordinated')).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent("Couldn't load nearby incidents")

    fireEvent.click(screen.getByRole('button', { name: /retry nearby/i }))

    expect(retry).toHaveBeenCalledOnce()
  })
})
