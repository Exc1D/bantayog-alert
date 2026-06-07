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

  it('empty state when all dispatches are older than 24h', () => {
    const fixedNow = new Date('2024-01-15T14:30:00.000Z').getTime()
    stubDate(fixedNow)
    render(
      <DispatchVolumeChart rows={[makeRow({ dispatchedAt: fixedNow - 25 * 60 * 60 * 1000 })]} />,
    )
    expect(screen.getByText(/no dispatches/i)).toBeInTheDocument()
  })

  it('shows dispatch count in aria-label for current hour bar', () => {
    const fixedNow = new Date('2024-01-15T14:30:00.000Z').getTime()
    const currentHour = new Date(fixedNow).getHours()
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
    expect(bars[currentHour]).toHaveAttribute('aria-label', expect.stringContaining('2'))
    expect(bars[currentHour]).toHaveStyle({ height: '100%' })
  })
})
