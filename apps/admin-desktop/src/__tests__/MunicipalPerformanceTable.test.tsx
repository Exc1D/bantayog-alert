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
})
