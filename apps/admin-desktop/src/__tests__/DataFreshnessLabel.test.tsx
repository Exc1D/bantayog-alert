import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { DataFreshnessLabel } from '../components/DataFreshnessLabel'

describe('DataFreshnessLabel', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders "Updated just now" for recent timestamp', () => {
    const now = Date.now()
    render(<DataFreshnessLabel lastUpdatedAt={now} />)
    expect(screen.getByText('Updated just now')).toBeInTheDocument()
  })

  it('renders seconds ago for <60s', () => {
    const thirtySecondsAgo = Date.now() - 30_000
    render(<DataFreshnessLabel lastUpdatedAt={thirtySecondsAgo} />)
    expect(screen.getByText('Updated 30s ago')).toBeInTheDocument()
  })

  it('renders amber warning for 1-5 min stale', () => {
    const twoMinutesAgo = Date.now() - 120_000
    render(<DataFreshnessLabel lastUpdatedAt={twoMinutesAgo} />)
    expect(screen.getByText('Updated 2m ago')).toBeInTheDocument()
    // Amber status indicator
    expect(screen.getByTestId('freshness-dot')).toHaveClass('bg-amber-500')
  })

  it('renders red warning for >5 min stale', () => {
    const tenMinutesAgo = Date.now() - 600_000
    render(<DataFreshnessLabel lastUpdatedAt={tenMinutesAgo} />)
    expect(screen.getByText('Updated 10m ago — data may be stale')).toBeInTheDocument()
    expect(screen.getByTestId('freshness-dot')).toHaveClass('bg-red-500')
  })

  it('updates elapsed time every 10 seconds', () => {
    const now = Date.now()
    vi.setSystemTime(now)
    render(<DataFreshnessLabel lastUpdatedAt={now} />)
    expect(screen.getByText('Updated just now')).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(10_000)
    })
    expect(screen.getByText('Updated 10s ago')).toBeInTheDocument()
  })
})
