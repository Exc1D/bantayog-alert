import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DispatchVolumeChart } from './DispatchVolumeChart'
import type { DispatchLifecycleRow } from '../hooks/useDispatchLifecycle'
import { makeRow } from '../test-utils'

describe('DispatchVolumeChart', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  function stubDate(fixedNow: number) {
    class MockDate extends Date {
      static override now() {
        return fixedNow
      }
    }
    vi.stubGlobal('Date', MockDate)
  }

  it('renders skeleton when loading', () => {
    render(<DispatchVolumeChart rows={[]} isLoading={true} />)
    const skeleton = screen.getByTestId('dispatch-volume-skeleton')
    expect(skeleton).toBeInTheDocument()
    expect(screen.queryByText(/no dispatches/i)).not.toBeInTheDocument()
  })

  it('renders 24 bars', () => {
    const fixedNow = new Date('2024-01-15T14:30:00.000Z').getTime()
    stubDate(fixedNow)
    render(<DispatchVolumeChart rows={[makeRow({ dispatchedAt: fixedNow })]} />)
    expect(screen.getAllByRole('img')).toHaveLength(24)
  })

  it('empty state when no dispatches', () => {
    const rows: DispatchLifecycleRow[] = []
    render(<DispatchVolumeChart rows={rows} />)
    expect(screen.getByText(/no dispatches/i)).toBeInTheDocument()
  })

  it('empty state when all dispatches are older than the displayed window', () => {
    const fixedNow = new Date('2024-01-15T14:30:00.000Z').getTime()
    stubDate(fixedNow)
    render(
      <DispatchVolumeChart rows={[makeRow({ dispatchedAt: fixedNow - 24 * 60 * 60 * 1000 })]} />,
    )
    expect(screen.getByText(/no dispatches/i)).toBeInTheDocument()
  })

  it('orders bars chronologically from 23 hours ago through now', () => {
    const fixedNow = new Date('2024-01-15T14:30:00.000Z').getTime()
    stubDate(fixedNow)
    render(
      <DispatchVolumeChart
        rows={[
          makeRow({ dispatchedAt: fixedNow - 23 * 60 * 60 * 1000, dispatchId: 'oldest' }),
          makeRow({ dispatchedAt: fixedNow, dispatchId: 'current' }),
        ]}
      />,
    )

    const bars = screen.getAllByRole('img')
    expect(bars[0]).toHaveAttribute('aria-label', expect.stringContaining('1 dispatch'))
    expect(bars[23]).toHaveAttribute('aria-label', expect.stringContaining('1 dispatch'))
  })

  it('shows dispatch count in aria-label for the latest bar', () => {
    const fixedNow = new Date('2024-01-15T14:30:00.000Z').getTime()
    stubDate(fixedNow)
    render(
      <DispatchVolumeChart
        rows={[
          makeRow({ dispatchedAt: fixedNow }),
          makeRow({ dispatchedAt: fixedNow, dispatchId: '2' }),
        ]}
      />,
    )
    const bars = screen.getAllByRole('img')
    expect(bars[23]).toHaveAttribute('aria-label', expect.stringContaining('2 dispatches'))
    expect(bars[23]).toHaveStyle({ height: '100%' })
  })
})
