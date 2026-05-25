import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DispatchStatsCards } from '../components/DispatchStatsCards'

const DEFAULT_PROPS = {
  activeCount: 5,
  stalledCount: 0,
  avgAcceptSeconds: null as number | null,
  fcmSuccessRate: 0.95,
  mode: 'active' as const,
}

describe('DispatchStatsCards', () => {
  it('renders Active Now card with top accent and role region', () => {
    render(<DispatchStatsCards {...DEFAULT_PROPS} />)
    const card = screen.getByLabelText('Active Now')
    expect(card).toHaveTextContent('5')
    expect(card).toHaveClass('border-t-blue-400')
    expect(card).toHaveAttribute('role', 'region')
  })

  it('renders Stalled card with red accent when > 0', () => {
    render(<DispatchStatsCards {...DEFAULT_PROPS} stalledCount={3} />)
    const card = screen.getByLabelText('Stalled')
    expect(card).toHaveTextContent('3')
    expect(card).toHaveClass('border-t-red-400')
    expect(card).not.toHaveClass('border-t-gray-400')
  })

  it('renders Stalled card with gray accent when zero', () => {
    render(<DispatchStatsCards {...DEFAULT_PROPS} />)
    const card = screen.getByLabelText('Stalled')
    expect(card).toHaveTextContent('0')
    expect(card).toHaveClass('border-t-gray-400')
  })

  it('formats avgAcceptSeconds as "2m 30s" and shows it when present', () => {
    render(<DispatchStatsCards {...DEFAULT_PROPS} avgAcceptSeconds={150} />)
    const card = screen.getByLabelText('Average accept time')
    expect(card).toHaveTextContent('2m 30s')
  })

  it('shows "—" for avgAcceptSeconds when null', () => {
    render(<DispatchStatsCards {...DEFAULT_PROPS} />)
    const card = screen.getByLabelText('Average accept time')
    expect(card).toHaveTextContent('—')
  })

  it('renders FCM Rate as "95%" with green accent when >= 90%', () => {
    render(<DispatchStatsCards {...DEFAULT_PROPS} />)
    const card = screen.getByLabelText('FCM success rate')
    expect(card).toHaveTextContent('95%')
    expect(card).toHaveClass('text-green-400')
  })

  it('renders FCM Rate with amber accent when < 90%', () => {
    render(<DispatchStatsCards {...DEFAULT_PROPS} fcmSuccessRate={0.85} />)
    const card = screen.getByLabelText('FCM success rate')
    expect(card).toHaveTextContent('85%')
    expect(card).toHaveClass('text-amber-400')
  })

  it('renders FCM Rate as "0%" when value is 0', () => {
    render(<DispatchStatsCards {...DEFAULT_PROPS} activeCount={0} fcmSuccessRate={0} />)
    const card = screen.getByLabelText('FCM success rate')
    expect(card).toHaveTextContent('0%')
    expect(card).toHaveClass('text-amber-400')
  })

  it('shows trend arrow when avgAcceptSeconds changes by >10%', () => {
    const { rerender } = render(<DispatchStatsCards {...DEFAULT_PROPS} avgAcceptSeconds={100} />)
    rerender(<DispatchStatsCards {...DEFAULT_PROPS} avgAcceptSeconds={120} />)
    expect(screen.getByText(/↑/)).toBeInTheDocument()
  })

  it('does not use side-stripe borders', () => {
    render(<DispatchStatsCards {...DEFAULT_PROPS} />)
    const cards = screen.getAllByRole('region')
    for (const card of cards) {
      expect(card.className).not.toMatch(/border-l-/)
    }
  })

  it('shows all 4 cards in active mode', () => {
    render(<DispatchStatsCards {...DEFAULT_PROPS} mode="active" />)
    expect(screen.getByLabelText('Active Now')).toBeInTheDocument()
    expect(screen.getByLabelText('Stalled')).toBeInTheDocument()
    expect(screen.getByLabelText('Average accept time')).toBeInTheDocument()
    expect(screen.getByLabelText('FCM success rate')).toBeInTheDocument()
  })

  it('only shows Active + Stalled in surge mode', () => {
    render(<DispatchStatsCards {...DEFAULT_PROPS} mode="surge" />)
    expect(screen.getByLabelText('Active Now')).toBeInTheDocument()
    expect(screen.getByLabelText('Stalled')).toBeInTheDocument()
    expect(screen.queryByLabelText('Average accept time')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('FCM success rate')).not.toBeInTheDocument()
  })
})
