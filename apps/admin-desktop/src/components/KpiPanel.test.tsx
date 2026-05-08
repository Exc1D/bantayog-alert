import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { KpiPanel, type KpiPanelProps } from '../components/KpiPanel'

const mockLiveData: KpiPanelProps['liveData'] = {
  activeIncidents: 15,
  respondersAvailable: 45,
  avgResponseTime: '12:30',
  resolvedToday: 8,
  unresolvedOver24h: 3,
  municipalitiesAffected: 5,
  systemHealthy: true,
  municipalData: [],
  anomalies: [],
  lastUpdated: Date.now(),
}

describe('KpiPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  it('renders panel title', () => {
    render(<KpiPanel liveData={mockLiveData} />)
    expect(screen.getByText('Key Performance Indicators')).toBeInTheDocument()
  })

  it('renders active incidents count', () => {
    render(<KpiPanel liveData={mockLiveData} />)
    expect(screen.getByText('15')).toBeInTheDocument()
    expect(screen.getByText(/Active Incidents/i)).toBeInTheDocument()
  })

  it('renders responders available count', () => {
    render(<KpiPanel liveData={mockLiveData} />)
    expect(screen.getByText('45')).toBeInTheDocument()
    expect(screen.getByText(/Responders Available/i)).toBeInTheDocument()
  })

  it('renders average response time', () => {
    render(<KpiPanel liveData={mockLiveData} />)
    expect(screen.getByText('12:30')).toBeInTheDocument()
    expect(screen.getByText(/Avg Response Time/i)).toBeInTheDocument()
  })

  it('renders resolved today count', () => {
    render(<KpiPanel liveData={mockLiveData} />)
    expect(screen.getByText('8')).toBeInTheDocument()
    expect(screen.getByText(/Resolved Today/i)).toBeInTheDocument()
  })

  it('renders unresolved over 24h count', () => {
    render(<KpiPanel liveData={mockLiveData} />)
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText(/Unresolved >24h/i)).toBeInTheDocument()
  })

  it('renders municipalities affected count', () => {
    render(<KpiPanel liveData={mockLiveData} />)
    expect(screen.getByText('5')).toBeInTheDocument()
    expect(screen.getByText(/Municipalities Affected/i)).toBeInTheDocument()
  })

  it('shows warning color for moderate unresolved count', () => {
    const dataWithModerateUnresolved = {
      ...mockLiveData,
      unresolvedOver24h: 3,
    }
    render(<KpiPanel liveData={dataWithModerateUnresolved} />)
    const card = screen.getByTestId('kpi-card-unresolved')
    expect(card).toHaveStyle({ borderLeftColor: '#c77600' })
  })

  it('shows critical color for very high active incidents', () => {
    const dataWithHighActive = {
      ...mockLiveData,
      activeIncidents: 25,
    }
    render(<KpiPanel liveData={dataWithHighActive} />)
    const card = screen.getByTestId('kpi-card-active')
    expect(card).toHaveStyle({ borderLeftColor: '#a73400' })
  })

  it('shows normal color for healthy metrics', () => {
    render(<KpiPanel liveData={mockLiveData} />)
    const card = screen.getByTestId('kpi-card-responders')
    expect(card).toHaveStyle({ borderLeftColor: '#2d6a4f' })
  })
})
