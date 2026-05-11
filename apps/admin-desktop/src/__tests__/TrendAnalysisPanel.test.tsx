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
    expect(screen.getByRole('button', { name: 'Incident Volume' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Response Time' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Resource Util' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Muni Comparison' })).toBeInTheDocument()
  })

  it('shows default 7d time range', () => {
    render(<TrendAnalysisPanel {...defaultProps} />)
    expect(screen.getByRole('button', { name: '7d' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('switches active tab when clicked', async () => {
    const user = userEvent.setup()
    render(<TrendAnalysisPanel {...defaultProps} />)
    const responseTimeTab = screen.getByRole('button', { name: 'Response Time' })
    await user.click(responseTimeTab)
    expect(responseTimeTab).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Incident Volume' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
  })

  it('switches time range when clicked', async () => {
    const user = userEvent.setup()
    render(<TrendAnalysisPanel {...defaultProps} />)
    await user.click(screen.getByRole('button', { name: '24h' }))
    expect(screen.getByRole('button', { name: '24h' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: '7d' })).toHaveAttribute('aria-pressed', 'false')
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
    expect(screen.getByRole('status')).toHaveTextContent('Incident Volume · 7d (1 reports)')
  })
})
