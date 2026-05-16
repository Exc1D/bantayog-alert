import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ActiveIncidentsTable } from '../components/ActiveIncidentsTable'
import type { Report } from '../types'

function makeReport(overrides: Partial<Report> = {}): Report {
  return {
    id: 'r1',
    type: 'flood',
    severity: 'high',
    status: 'verified',
    municipality: 'Daet',
    barangay: 'Camambugan',
    description: '',
    reporterName: '',
    reporterPhone: '',
    latitude: 14.1,
    longitude: 122.9,
    createdAt: new Date().toISOString(),
    updatedAt: '',
    ...overrides,
  }
}

describe('ActiveIncidentsTable', () => {
  it('renders empty state with role=status when no reports', () => {
    render(<ActiveIncidentsTable reports={[]} onRowClick={vi.fn()} />)
    const status = screen.getByRole('status')
    expect(status).toHaveTextContent('No active incidents to track')
  })

  it('renders one row per report with municipality and barangay', () => {
    const reports = [
      makeReport({ id: 'r1', municipality: 'Daet', barangay: 'Camambugan' }),
      makeReport({ id: 'r2', municipality: 'Labo', barangay: 'San Roque' }),
    ]
    render(<ActiveIncidentsTable reports={reports} onRowClick={vi.fn()} />)
    expect(screen.getByText('Daet')).toBeInTheDocument()
    expect(screen.getByText('Camambugan')).toBeInTheDocument()
    expect(screen.getByText('Labo')).toBeInTheDocument()
    expect(screen.getByText('San Roque')).toBeInTheDocument()
  })

  it('renders human-readable label for en_route status', () => {
    render(
      <ActiveIncidentsTable reports={[makeReport({ status: 'en_route' })]} onRowClick={vi.fn()} />,
    )
    expect(screen.getByText('En Route')).toBeInTheDocument()
  })

  it('renders human-readable label for on_scene status', () => {
    render(
      <ActiveIncidentsTable reports={[makeReport({ status: 'on_scene' })]} onRowClick={vi.fn()} />,
    )
    expect(screen.getByText('On Scene')).toBeInTheDocument()
  })

  it('renders human-readable label for cancelled_false_report status', () => {
    render(
      <ActiveIncidentsTable
        reports={[makeReport({ status: 'cancelled_false_report' })]}
        onRowClick={vi.fn()}
      />,
    )
    expect(screen.getByText('Cancelled (False)')).toBeInTheDocument()
  })

  it('falls back to raw status string when label is missing', () => {
    const unknownStatus = 'mystery_status' as Report['status']
    render(
      <ActiveIncidentsTable
        reports={[makeReport({ status: unknownStatus })]}
        onRowClick={vi.fn()}
      />,
    )
    expect(screen.getByText('mystery_status')).toBeInTheDocument()
  })

  it('invokes onRowClick with the report when a row is clicked', async () => {
    const user = userEvent.setup()
    const onRowClick = vi.fn()
    const report = makeReport({ id: 'r1', barangay: 'Camambugan' })
    render(<ActiveIncidentsTable reports={[report]} onRowClick={onRowClick} />)
    await user.click(screen.getByText('Camambugan'))
    expect(onRowClick).toHaveBeenCalledTimes(1)
    expect(onRowClick).toHaveBeenCalledWith(report)
  })

  it('renders relative time for createdAt (e.g. "5m ago")', () => {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()
    render(
      <ActiveIncidentsTable
        reports={[makeReport({ createdAt: fiveMinutesAgo })]}
        onRowClick={vi.fn()}
      />,
    )
    expect(screen.getByText('5m ago')).toBeInTheDocument()
  })
})
