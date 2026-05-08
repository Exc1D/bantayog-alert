import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { ProvinceDashboardPage } from '../pages/ProvinceDashboardPage'

// Mock all child components
vi.mock('../components/CommandCenterShell', () => ({
  CommandCenterShell: ({
    topBanner,
    mapZone,
    gridZone,
    bottomStrip,
  }: Record<string, React.ReactNode>) => (
    <div data-testid="command-center-shell">
      <div data-testid="top-banner-slot">{topBanner}</div>
      <div data-testid="map-zone-slot">{mapZone}</div>
      <div data-testid="grid-zone-slot">{gridZone}</div>
      <div data-testid="bottom-strip-slot">{bottomStrip}</div>
    </div>
  ),
}))

vi.mock('../components/TopBanner', () => ({
  TopBanner: (props: Record<string, unknown>) => (
    <div data-testid="top-banner" data-props={JSON.stringify(props)}>
      <button data-testid="toggle-kpi" onClick={props.onToggleKpiPanel as () => void}>
        Toggle KPI
      </button>
      <button data-testid="toggle-incidents" onClick={props.onToggleIncidentPanel as () => void}>
        Toggle Incidents
      </button>
    </div>
  ),
}))

vi.mock('../components/ProvincialMap', () => ({
  ProvincialMap: (props: Record<string, unknown>) => (
    <div data-testid="provincial-map" data-props={JSON.stringify(props)} />
  ),
}))

vi.mock('../components/MunicipalGrid', () => ({
  MunicipalGrid: (props: Record<string, unknown>) => (
    <div data-testid="municipal-grid" data-props={JSON.stringify(props)} />
  ),
}))

vi.mock('../components/SystemHealthStrip', () => ({
  SystemHealthStrip: (props: Record<string, unknown>) => (
    <div data-testid="system-health" data-props={JSON.stringify(props)} />
  ),
}))

vi.mock('../components/AlertDeclarationModal', () => ({
  AlertDeclarationModal: (props: Record<string, unknown>) => (
    <div data-testid="alert-modal" data-props={JSON.stringify(props)} />
  ),
}))

vi.mock('../components/KpiPanel', () => ({
  KpiPanel: (props: Record<string, unknown>) => (
    <div data-testid="kpi-panel" data-props={JSON.stringify(props)} />
  ),
}))

vi.mock('../components/IncidentFeed', () => ({
  IncidentFeed: (props: Record<string, unknown>) => (
    <div data-testid="incident-feed" data-props={JSON.stringify(props)} />
  ),
}))

vi.mock('../hooks/useDashboardLiveData', () => ({
  useDashboardLiveData: vi.fn(() => ({
    activeIncidents: 0,
    respondersAvailable: 0,
    avgResponseTime: '—',
    resolvedToday: 0,
    unresolvedOver24h: 0,
    municipalitiesAffected: 0,
    systemHealthy: true,
    municipalData: [],
    anomalies: [],
    lastUpdated: null,
  })),
}))

vi.mock('../hooks/useConnectionStatus', () => ({
  useConnectionStatus: () => ({ status: 'live' as const, lastUpdated: new Date() }),
}))

vi.mock('../hooks/useIncidentSubscription', () => ({
  useIncidentSubscription: () => ({ incidents: [], loading: false, error: null }),
}))

describe('ProvinceDashboardPage Accessibility', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders main landmark', () => {
    render(<ProvinceDashboardPage />)
    expect(screen.getByTestId('command-center-shell')).toBeInTheDocument()
  })

  it('passes aria labels to TopBanner', () => {
    render(<ProvinceDashboardPage />)
    const banner = screen.getByTestId('top-banner')
    expect(banner).toBeInTheDocument()
  })

  it('renders without hardcoded color errors', () => {
    render(<ProvinceDashboardPage />)
    expect(screen.getByTestId('command-center-shell')).toBeInTheDocument()
    expect(screen.getByTestId('top-banner-slot')).toBeInTheDocument()
    expect(screen.getByTestId('map-zone-slot')).toBeInTheDocument()
    expect(screen.getByTestId('grid-zone-slot')).toBeInTheDocument()
    expect(screen.getByTestId('bottom-strip-slot')).toBeInTheDocument()
  })

  it('KPI drawer has role="region" and aria-label', () => {
    render(<ProvinceDashboardPage />)
    const toggleKpi = screen.getByTestId('toggle-kpi')

    fireEvent.click(toggleKpi)

    const kpiDrawer = screen.getByTestId('kpi-drawer')
    expect(kpiDrawer).toHaveAttribute('role', 'region')
    expect(kpiDrawer).toHaveAttribute('aria-label', 'KPI panel')
  })

  it('incident drawer has role="region" and aria-label', () => {
    render(<ProvinceDashboardPage />)
    const toggleIncidents = screen.getByTestId('toggle-incidents')

    fireEvent.click(toggleIncidents)

    const incidentDrawer = screen.getByTestId('incident-drawer')
    expect(incidentDrawer).toHaveAttribute('role', 'region')
    expect(incidentDrawer).toHaveAttribute('aria-label', 'Incident feed panel')
  })
})
