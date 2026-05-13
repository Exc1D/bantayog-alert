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

  it('shows surge glow when pending >= 20, guarded by motion-safe so users who prefer reduced motion are not animated', () => {
    render(<StatusBar activeIncidents={10} avgResponseTime={5} pendingTriage={22} />)
    const bar = screen.getByText('22').closest('div')?.parentElement?.parentElement
    expect(bar).toHaveClass('motion-safe:animate-pulse')
    expect(bar).toHaveClass('border-[var(--color-severity-medium)]')
    // Regression: the unguarded class must NOT be present — it would override the reduced-motion preference.
    expect(bar?.className.split(/\s+/)).not.toContain('animate-pulse')
  })

  it('shows surge glow when active incidents >= 50, guarded by motion-safe', () => {
    render(<StatusBar activeIncidents={55} avgResponseTime={5} pendingTriage={5} />)
    const bar = screen.getByText('55').closest('div')?.parentElement?.parentElement
    expect(bar).toHaveClass('motion-safe:animate-pulse')
    expect(bar).toHaveClass('border-[var(--color-severity-medium)]')
    expect(bar?.className.split(/\s+/)).not.toContain('animate-pulse')
  })

  it('does not apply the pulse class when not in surge', () => {
    render(<StatusBar activeIncidents={7} avgResponseTime={4} pendingTriage={3} />)
    const bar = screen.getByText('7').closest('div')?.parentElement?.parentElement
    expect(bar?.className).not.toMatch(/animate-pulse/)
  })

  it('renders em-dash placeholders for resolved/muni stats when no data is supplied', () => {
    render(<StatusBar activeIncidents={7} avgResponseTime={4} pendingTriage={3} />)
    // Regression: hardcoded prototype values "89" and "0/12" must not be present.
    expect(screen.queryByText('89')).not.toBeInTheDocument()
    expect(screen.queryByText('0/12')).not.toBeInTheDocument()
    // Truth-gate: both rows show em-dash until real aggregation is wired.
    expect(screen.getByTestId('statusbar-resolved-today')).toHaveTextContent('—')
    expect(screen.getByTestId('statusbar-muni-issues')).toHaveTextContent('—')
  })

  it('renders supplied resolved/muni stats when props are provided', () => {
    render(
      <StatusBar
        activeIncidents={7}
        avgResponseTime={4}
        pendingTriage={3}
        resolvedToday={42}
        muniIssues={{ resolved: 3, total: 12 }}
      />,
    )
    expect(screen.getByTestId('statusbar-resolved-today')).toHaveTextContent('42')
    expect(screen.getByTestId('statusbar-muni-issues')).toHaveTextContent('3/12')
  })
})
