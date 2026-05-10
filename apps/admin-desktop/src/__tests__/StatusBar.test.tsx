import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StatusBar } from '../components/StatusBar'

describe('StatusBar', () => {
  it('renders three metrics', () => {
    render(
      <StatusBar
        activeIncidents={47}
        avgResponseTime={12}
        pendingTriage={8}
        resolvedToday={0}
        municipalitiesWithIssues={{ withIssues: 0, total: 12 }}
      />,
    )
    expect(screen.getByText('47')).toBeInTheDocument()
    expect(screen.getByText('12')).toBeInTheDocument()
    expect(screen.getByText('8')).toBeInTheDocument()
  })

  it('shows surge glow when pending > 5', () => {
    render(
      <StatusBar
        activeIncidents={10}
        avgResponseTime={5}
        pendingTriage={8}
        resolvedToday={0}
        municipalitiesWithIssues={{ withIssues: 0, total: 12 }}
      />,
    )
    const bar = screen.getByTestId('status-bar')
    expect(bar).toHaveStyle('box-shadow: 0 0 40px rgba(167, 52, 0, 0.25)')
  })

  it('renders resolvedToday and municipalitiesWithIssues from props in expanded section', () => {
    // pendingTriage <= 5 → !isSurge → expanded defaults to true, expanded section visible
    render(
      <StatusBar
        activeIncidents={10}
        avgResponseTime={5}
        pendingTriage={2}
        resolvedToday={42}
        municipalitiesWithIssues={{ withIssues: 3, total: 12 }}
      />,
    )
    expect(screen.getByText('42')).toBeInTheDocument()
    expect(screen.getByText('3/12')).toBeInTheDocument()
  })
})
