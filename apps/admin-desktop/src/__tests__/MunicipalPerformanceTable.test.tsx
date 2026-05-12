import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MunicipalPerformanceTable } from '../components/MunicipalPerformanceTable'
import type { MunicipalPerformance } from '../types'

const mockData: MunicipalPerformance[] = [
  {
    municipality: 'Daet',
    activeIncidents: 12,
    activeResponders: 15,
    avgResponseTime: '8 min',
    unresolvedOver24h: 1,
    adminOnDuty: true,
    adminName: 'Santos',
  },
  {
    municipality: 'Capalonga',
    activeIncidents: 3,
    activeResponders: 9,
    avgResponseTime: '18 min',
    unresolvedOver24h: 2,
    adminOnDuty: false,
  },
]

describe('MunicipalPerformanceTable', () => {
  it('renders municipality rows', () => {
    render(<MunicipalPerformanceTable data={mockData} onSelectMunicipality={vi.fn()} />)
    expect(screen.getByText('Daet')).toBeInTheDocument()
    expect(screen.getByText('Capalonga')).toBeInTheDocument()
  })

  it('shows active incident counts', () => {
    render(<MunicipalPerformanceTable data={mockData} onSelectMunicipality={vi.fn()} />)
    expect(screen.getByText('12')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('shows admin on-duty status', () => {
    render(<MunicipalPerformanceTable data={mockData} onSelectMunicipality={vi.fn()} />)
    expect(screen.getByText('On Duty')).toBeInTheDocument()
    expect(screen.getByText('No Shift')).toBeInTheDocument()
  })

  it('calls onSelectMunicipality when row clicked', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(<MunicipalPerformanceTable data={mockData} onSelectMunicipality={onSelect} />)
    await user.click(screen.getByText('Daet'))
    expect(onSelect).toHaveBeenCalledWith('Daet')
  })

  it('sorts by municipality name when header clicked', async () => {
    const user = userEvent.setup()
    render(<MunicipalPerformanceTable data={mockData} onSelectMunicipality={vi.fn()} />)
    const nameHeader = screen.getByRole('button', { name: /municipality/i })
    await user.click(nameHeader)
    // Ascending: Capalonga before Daet
    const rows = screen.getAllByRole('row')
    expect(rows[1]).toHaveTextContent('Capalonga')
    expect(rows[2]).toHaveTextContent('Daet')
  })

  it('sorts by avg response time when header clicked', async () => {
    const user = userEvent.setup()
    render(<MunicipalPerformanceTable data={mockData} onSelectMunicipality={vi.fn()} />)
    const responseHeader = screen.getByRole('button', { name: /avg response/i })
    await user.click(responseHeader)
    // Ascending by minutes: Daet (8) before Capalonga (18)
    const rows = screen.getAllByRole('row')
    expect(rows[1]).toHaveTextContent('Daet')
  })

  it('sorts by active incidents when header clicked', async () => {
    const user = userEvent.setup()
    render(<MunicipalPerformanceTable data={mockData} onSelectMunicipality={vi.fn()} />)
    const incidentsHeader = screen.getByRole('button', { name: /active incidents/i })
    await user.click(incidentsHeader)
    // After sorting ascending, Capalonga (3) should appear before Daet (12)
    const rows = screen.getAllByRole('row')
    expect(rows[1]).toHaveTextContent('Capalonga')
  })

  it('shows response time indicator', () => {
    render(<MunicipalPerformanceTable data={mockData} onSelectMunicipality={vi.fn()} />)
    // Daet: 8 min = good (<12), Capalonga: 18 min = warning (12-20)
    expect(screen.getByText('8 min')).toBeInTheDocument()
    expect(screen.getByText('18 min')).toBeInTheDocument()
  })

  it('applies color to response time cells', () => {
    render(<MunicipalPerformanceTable data={mockData} onSelectMunicipality={vi.fn()} />)
    const goodCell = screen.getByText('8 min').closest('td')
    const warningCell = screen.getByText('18 min').closest('td')
    // happy-dom doesn't resolve CSS custom properties in toHaveStyle, so check the inline style directly
    expect(goodCell?.style.color).toBe('var(--color-norm)')
    expect(warningCell?.style.color).toBe('var(--color-warn)')
  })

  it('renders em-dash placeholders when synthesized fields are undefined', () => {
    // Truth gate: producers (DashboardPage, MapPage) omit fields they cannot derive from
    // the report stream. Renderer must surface "—" rather than fabricating 0 / "0m" / "No Shift",
    // and the response-time color must stay neutral so we don't paint green for unwired data.
    const unwired: MunicipalPerformance[] = [
      {
        municipality: 'Labo',
        activeIncidents: 4,
      },
    ]
    render(<MunicipalPerformanceTable data={unwired} onSelectMunicipality={vi.fn()} />)
    expect(screen.getByTestId('muniperf-responders-Labo')).toHaveTextContent('—')
    expect(screen.getByTestId('muniperf-response-Labo')).toHaveTextContent('—')
    expect(screen.getByTestId('muniperf-admin-Labo')).toHaveTextContent('—')
    // Regression: prototype values must not appear for unwired rows.
    expect(screen.queryByText('0')).not.toBeInTheDocument()
    expect(screen.queryByText('0 min')).not.toBeInTheDocument()
    expect(screen.queryByText('No Shift')).not.toBeInTheDocument()
    // Color must be neutral, not 'var(--color-norm)' (which would imply healthy response time).
    const responseCell = screen.getByTestId('muniperf-response-Labo').closest('td')
    expect(responseCell?.style.color).toBe('var(--color-text-secondary)')
  })

  it('sorts undefined avg response time to the end when ascending', async () => {
    // Unwired rows should sort last when ascending so triage focus stays on real data.
    const mixed: MunicipalPerformance[] = [
      { municipality: 'Daet', activeIncidents: 1, avgResponseTime: '8 min' },
      { municipality: 'Labo', activeIncidents: 2 },
      { municipality: 'Capalonga', activeIncidents: 3, avgResponseTime: '18 min' },
    ]
    const user = userEvent.setup()
    render(<MunicipalPerformanceTable data={mixed} onSelectMunicipality={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: /avg response/i }))
    const rows = screen.getAllByRole('row')
    // header + Daet(8) + Capalonga(18) + Labo(undefined → Infinity, last)
    expect(rows[1]).toHaveTextContent('Daet')
    expect(rows[2]).toHaveTextContent('Capalonga')
    expect(rows[3]).toHaveTextContent('Labo')
  })
})
