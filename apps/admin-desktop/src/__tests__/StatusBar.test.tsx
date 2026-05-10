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

  it('shows surge glow when pending >= 20', () => {
    render(<StatusBar activeIncidents={10} avgResponseTime={5} pendingTriage={22} />)
    const bar = screen.getByText('22').closest('div')?.parentElement?.parentElement
    expect(bar).toHaveClass('animate-pulse')
    expect(bar).toHaveClass('border-[#c77600]')
  })

  it('shows surge glow when active incidents >= 50', () => {
    render(<StatusBar activeIncidents={55} avgResponseTime={5} pendingTriage={5} />)
    const bar = screen.getByText('55').closest('div')?.parentElement?.parentElement
    expect(bar).toHaveClass('animate-pulse')
    expect(bar).toHaveClass('border-[#c77600]')
  })
})
