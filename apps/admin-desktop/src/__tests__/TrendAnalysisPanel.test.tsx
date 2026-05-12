import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TrendAnalysisPanel } from '../components/TrendAnalysisPanel'

const defaultProps = {
  reports: [],
  reportOps: [],
  responders: [],
}

describe('TrendAnalysisPanel', () => {
  it('renders chart tabs', () => {
    render(<TrendAnalysisPanel {...defaultProps} />)
    expect(screen.getByRole('button', { name: 'Volume' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Response' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Resources' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Comparison' })).toBeInTheDocument()
  })

  it('shows default 7d time range', () => {
    render(<TrendAnalysisPanel {...defaultProps} />)
    expect(screen.getByRole('button', { name: /last 7 days/i })).toBeInTheDocument()
  })

  it('switches active tab when clicked', async () => {
    const user = userEvent.setup()
    render(<TrendAnalysisPanel {...defaultProps} />)
    const responseTab = screen.getByRole('button', { name: 'Response' })
    await user.click(responseTab)
    expect(responseTab).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Volume' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('switches time range when clicked', async () => {
    const user = userEvent.setup()
    render(<TrendAnalysisPanel {...defaultProps} />)
    await user.click(screen.getByRole('button', { name: /last 7 days/i }))
    await user.click(screen.getByRole('option', { name: /last 24 hours/i }))
    expect(screen.getByRole('button', { name: /last 24 hours/i })).toBeInTheDocument()
  })

  it('renders empty state when no reports', () => {
    render(<TrendAnalysisPanel {...defaultProps} />)
    expect(screen.getByRole('status')).toHaveTextContent('No incidents in selected period')
  })

  it('renders report count when reports exist', () => {
    const reports = [
      {
        id: 'r1',
        type: 'flood',
        severity: 'high',
        municipality: 'Daet',
        barangay: 'Barangay 1',
        createdAt: new Date().toISOString(),
        status: 'new',
        description: 'Test',
      },
    ]
    render(<TrendAnalysisPanel {...defaultProps} reports={reports} />)
    expect(screen.getByRole('status')).toHaveTextContent('Volume · Last 7 days (1 reports)')
  })
})
