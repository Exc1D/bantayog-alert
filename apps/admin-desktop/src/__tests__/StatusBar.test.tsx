import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StatusBar } from '../components/StatusBar'

describe('StatusBar', () => {
  it('renders three metrics', () => {
    render(<StatusBar activeIncidents={47} avgResponseTime={12} pendingTriage={8} />)
    expect(screen.getByText('47')).toBeInTheDocument()
    expect(screen.getByText('12')).toBeInTheDocument()
    expect(screen.getByText('8')).toBeInTheDocument()
  })

  it('shows surge glow when pending > 5', () => {
    render(<StatusBar activeIncidents={10} avgResponseTime={5} pendingTriage={8} />)
    const bar = screen.getByText('8').closest('div')?.parentElement?.parentElement
    // happy-dom parses border-left shorthand into individual properties with quirks;
    // assert on the box-shadow which is unambiguously present in surge mode
    expect(bar).toHaveStyle('box-shadow: 0 0 40px rgba(167, 52, 0, 0.25)')
  })
})
