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
  it('renders incident volume heading and time range dropdown', () => {
    render(<TrendAnalysisPanel {...defaultProps} />)
    expect(screen.getByText('Incident Volume')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /last 7 days/i })).toBeInTheDocument()
  })

  it('shows default 7d time range', () => {
    render(<TrendAnalysisPanel {...defaultProps} />)
    expect(screen.getByRole('button', { name: /last 7 days/i })).toBeInTheDocument()
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
    expect(screen.getByRole('status')).toHaveTextContent(
      'Incident Volume · Last 7 days (1 reports)',
    )
  })
})
