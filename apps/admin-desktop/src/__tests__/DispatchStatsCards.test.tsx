import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DispatchStatsCards } from '../components/DispatchStatsCards'

describe('DispatchStatsCards', () => {
  it('renders Active Now card with blue accent', () => {
    render(
      <DispatchStatsCards
        activeCount={5}
        stalledCount={0}
        avgAcceptSeconds={null}
        fcmSuccessRate={0.95}
      />,
    )
    const card = screen.getByLabelText('Active Now')
    expect(card).toHaveTextContent('5')
    expect(card).toHaveClass('border-blue-400')
  })

  it('renders Stalled card with red accent when > 0', () => {
    render(
      <DispatchStatsCards
        activeCount={5}
        stalledCount={3}
        avgAcceptSeconds={null}
        fcmSuccessRate={0.95}
      />,
    )
    const card = screen.getByLabelText('Stalled')
    expect(card).toHaveTextContent('3')
    expect(card).toHaveClass('border-red-400')
    expect(card).not.toHaveClass('border-gray-400')
  })

  it('renders Stalled card with gray accent when zero', () => {
    render(
      <DispatchStatsCards
        activeCount={5}
        stalledCount={0}
        avgAcceptSeconds={null}
        fcmSuccessRate={0.95}
      />,
    )
    const card = screen.getByLabelText('Stalled')
    expect(card).toHaveTextContent('0')
    expect(card).toHaveClass('border-gray-400')
  })

  it('formats avgAcceptSeconds as "2m 30s" and shows it when present', () => {
    render(
      <DispatchStatsCards
        activeCount={5}
        stalledCount={0}
        avgAcceptSeconds={150}
        fcmSuccessRate={0.95}
      />,
    )
    const card = screen.getByLabelText('Average accept time')
    expect(card).toHaveTextContent('2m 30s')
  })

  it('shows "—" for avgAcceptSeconds when null', () => {
    render(
      <DispatchStatsCards
        activeCount={5}
        stalledCount={0}
        avgAcceptSeconds={null}
        fcmSuccessRate={0.95}
      />,
    )
    const card = screen.getByLabelText('Average accept time')
    expect(card).toHaveTextContent('—')
  })

  it('renders FCM Rate as "95%" with green accent when >= 90%', () => {
    render(
      <DispatchStatsCards
        activeCount={5}
        stalledCount={0}
        avgAcceptSeconds={null}
        fcmSuccessRate={0.95}
      />,
    )
    const card = screen.getByLabelText('FCM success rate')
    expect(card).toHaveTextContent('95%')
    expect(card).toHaveClass('text-green-400')
  })

  it('renders FCM Rate with amber accent when < 90%', () => {
    render(
      <DispatchStatsCards
        activeCount={5}
        stalledCount={0}
        avgAcceptSeconds={null}
        fcmSuccessRate={0.85}
      />,
    )
    const card = screen.getByLabelText('FCM success rate')
    expect(card).toHaveTextContent('85%')
    expect(card).toHaveClass('text-amber-400')
  })

  it('renders FCM Rate as "0%" when value is 0', () => {
    render(
      <DispatchStatsCards
        activeCount={0}
        stalledCount={0}
        avgAcceptSeconds={null}
        fcmSuccessRate={0}
      />,
    )
    const card = screen.getByLabelText('FCM success rate')
    expect(card).toHaveTextContent('0%')
    expect(card).toHaveClass('text-amber-400')
  })
})
