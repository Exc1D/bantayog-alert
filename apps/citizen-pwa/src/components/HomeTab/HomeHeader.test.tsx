import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { HomeHeader } from './HomeHeader.js'

describe('HomeHeader', () => {
  it('shows unread alert count as text and opens alerts from the bell', () => {
    const onOpenAlerts = vi.fn()

    render(
      <HomeHeader
        locationLabel="Daet, Camarines Norte"
        now={1_713_350_400_000}
        onOpenAlerts={onOpenAlerts}
        unreadAlertCount={3}
        updatedAt={1_713_350_280_000}
      />,
    )

    expect(screen.getByText('3')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /open alerts, 3 unread/i }))
    expect(onOpenAlerts).toHaveBeenCalledOnce()
  })

  it('keeps the bell reachable without a badge when there are no unread alerts', () => {
    const onOpenAlerts = vi.fn()

    render(<HomeHeader now={1_713_350_400_000} onOpenAlerts={onOpenAlerts} unreadAlertCount={0} />)

    expect(screen.queryByTestId('home-alert-badge')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /open alerts/i }))
    expect(onOpenAlerts).toHaveBeenCalledOnce()
  })

  it('truth-gates location and freshness instead of fabricating them', () => {
    const { rerender } = render(
      <HomeHeader now={1_713_350_400_000} onOpenAlerts={vi.fn()} unreadAlertCount={0} />,
    )

    expect(screen.queryByText(/Camarines Norte/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/^Updated /i)).not.toBeInTheDocument()

    rerender(
      <HomeHeader
        locationLabel="Daet, Camarines Norte"
        now={1_713_350_400_000}
        onOpenAlerts={vi.fn()}
        unreadAlertCount={0}
        updatedAt={1_713_350_280_000}
      />,
    )

    expect(screen.getByText('Daet, Camarines Norte')).toBeInTheDocument()
    expect(screen.getByText('Updated 2 minutes ago')).toBeInTheDocument()
  })
})
