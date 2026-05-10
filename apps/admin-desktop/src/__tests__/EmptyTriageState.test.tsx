import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { EmptyTriageState } from '../components/EmptyTriageState'

describe('EmptyTriageState', () => {
  it('renders all caught up message', () => {
    render(<EmptyTriageState />)
    expect(screen.getByText('All Caught Up')).toBeInTheDocument()
  })

  it('renders no reports pending message', () => {
    render(<EmptyTriageState />)
    expect(screen.getByText('No reports pending verification')).toBeInTheDocument()
  })

  it('shows green checkmark with status role', () => {
    render(<EmptyTriageState />)
    const check = screen.getByRole('status')
    expect(check).toBeInTheDocument()
    expect(check).toHaveAttribute('aria-label', 'All reports triaged')
  })

  it('shows last checked timestamp when provided', () => {
    render(<EmptyTriageState lastCheckedAt="14:32:05" />)
    expect(screen.getByText('Last checked: 14:32:05')).toBeInTheDocument()
  })

  it('does not show last checked when not provided', () => {
    render(<EmptyTriageState />)
    expect(screen.queryByText(/Last checked/)).not.toBeInTheDocument()
  })
})
