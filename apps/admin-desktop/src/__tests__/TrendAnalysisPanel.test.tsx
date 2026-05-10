import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TrendAnalysisPanel } from '../components/TrendAnalysisPanel'

describe('TrendAnalysisPanel', () => {
  it('renders chart tabs', () => {
    render(<TrendAnalysisPanel />)
    expect(screen.getByRole('button', { name: 'Incident Volume' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Response Time' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Resource Util' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Muni Comparison' })).toBeInTheDocument()
  })

  it('shows default 7d time range', () => {
    render(<TrendAnalysisPanel />)
    expect(screen.getByRole('button', { name: '7d' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('switches active tab when clicked', async () => {
    const user = userEvent.setup()
    render(<TrendAnalysisPanel />)
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
    render(<TrendAnalysisPanel />)
    await user.click(screen.getByRole('button', { name: '24h' }))
    expect(screen.getByRole('button', { name: '24h' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: '7d' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('renders chart placeholder for active tab', () => {
    render(<TrendAnalysisPanel />)
    expect(screen.getByRole('img', { name: /incident volume chart/i })).toBeInTheDocument()
  })
})
