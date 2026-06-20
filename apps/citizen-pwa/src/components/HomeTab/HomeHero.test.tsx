import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AlertDoc } from '@bantayog/shared-types'
import type { PublicIncident, MyReport } from '../MapTab/types.js'
import { HomeDataProvider, type HomeDataContextValue } from './HomeDataContext.js'
import { HomeTab } from './index.js'

const usePublicIncidentsMock = vi.hoisted(() => vi.fn())

vi.mock('../../hooks/usePublicIncidents.js', () => ({
  usePublicIncidents: usePublicIncidentsMock,
}))

const report = {
  publicRef: 'ref-1234',
  reportType: 'flood',
  severity: 'high',
  lat: 14.112,
  lng: 122.956,
  submittedAt: 1_713_350_000_000,
  status: 'verified',
  municipalityLabel: 'Daet',
} satisfies MyReport

const alert = {
  id: 'alert-1',
  title: 'Flood warning for low-lying barangays',
  body: 'Avoid riverside roads until responders clear the area.',
  severity: 'critical',
  publishedAt: 1_713_350_500_000,
  publishedBy: 'ops-1',
} satisfies AlertDoc

const nearbyIncident = {
  id: 'incident-1',
  reportType: 'fire',
  severity: 'medium',
  status: 'verified',
  barangayId: 'brgy-1',
  municipalityLabel: 'Daet',
  publicLocation: { lat: 14.115, lng: 122.958 },
  submittedAt: 1_713_350_250_000,
} satisfies PublicIncident

interface PublicIncidentResult {
  error: unknown
  incidents: PublicIncident[]
  loading: boolean
}

interface RenderHomeOptions {
  homeData?: Partial<HomeDataContextValue>
  incidentResult?: Partial<PublicIncidentResult>
}

const defaultHomeData = {
  alerts: [],
  alertsError: null,
  alertsLoading: false,
  reports: [report],
  reportsError: null,
  reportsLoading: false,
  unreadAlertCount: 0,
} satisfies HomeDataContextValue

const defaultIncidentResult = {
  error: null,
  incidents: [],
  loading: false,
} satisfies PublicIncidentResult

function renderHome({ homeData = {}, incidentResult = {} }: RenderHomeOptions = {}) {
  usePublicIncidentsMock.mockReturnValue({ ...defaultIncidentResult, ...incidentResult })

  return render(
    <MemoryRouter>
      <HomeDataProvider value={{ ...defaultHomeData, ...homeData }}>
        <HomeTab />
      </HomeDataProvider>
    </MemoryRouter>,
  )
}

describe('HomeHero', () => {
  beforeEach(() => {
    usePublicIncidentsMock.mockReset()
  })

  it('shows calm copy only after local alert, report, and incident data have settled', () => {
    renderHome()

    expect(screen.getByText('Daet is calm today')).toBeInTheDocument()
    expect(screen.getByText(/^You're caught up through /)).toBeInTheDocument()
    expect(screen.queryByText(/loading local brief/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/couldn't refresh/i)).not.toBeInTheDocument()
  })

  it('withholds calm copy while source state is loading or errored', () => {
    const { unmount } = renderHome({ homeData: { alertsLoading: true } })

    expect(screen.queryByText('Daet is calm today')).not.toBeInTheDocument()
    expect(screen.getByText(/loading local brief/i)).toBeInTheDocument()

    unmount()
    renderHome({ incidentResult: { error: new Error('offline') } })

    expect(screen.queryByText('Daet is calm today')).not.toBeInTheDocument()
    expect(screen.getByText(/couldn't refresh your local brief/i)).toBeInTheDocument()
  })

  it('renders an official alert as the dominant bounded hero without removing the secondary stack', () => {
    renderHome({ homeData: { alerts: [alert] }, incidentResult: { incidents: [nearbyIncident] } })

    const hero = screen.getByTestId('home-hero')
    expect(hero).toHaveTextContent('Flood warning for low-lying barangays')
    expect(hero).toHaveTextContent('CRITICAL')
    expect(hero.querySelector('svg')).not.toBeNull()
    expect(screen.getByRole('link', { name: /view official alert/i })).toHaveAttribute(
      'href',
      '/alerts',
    )
    expect(screen.getByTestId('home-secondary-stack')).toBeInTheDocument()
  })

  it('does not subscribe to public incidents when the known report coordinate has no area label', () => {
    renderHome({
      homeData: {
        reports: [{ ...report, municipalityLabel: '' }],
      },
      incidentResult: { incidents: [nearbyIncident] },
    })

    expect(usePublicIncidentsMock).not.toHaveBeenCalled()
    expect(screen.getByText('Local brief needs a known area')).toBeInTheDocument()
    expect(screen.queryByText(/incident reported nearby/i)).not.toBeInTheDocument()
  })
})
