import { describe, it, expect, vi, afterEach } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen, act } from '@testing-library/react'
import { AcceptanceCountdown } from './AcceptanceCountdown'

describe('AcceptanceCountdown', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('shows remaining time formatted as M:SS', () => {
    vi.useFakeTimers()
    const setIntervalSpy = vi.spyOn(globalThis, 'setInterval')
    const now = Date.now()
    const deadline = now + 120_000
    const { rerender } = render(<AcceptanceCountdown deadlineMs={deadline} nowMs={now} />)
    expect(screen.getByText('2:00')).toBeInTheDocument()
    expect(setIntervalSpy).not.toHaveBeenCalled()

    act(() => {
      vi.advanceTimersByTime(1000)
    })
    rerender(<AcceptanceCountdown deadlineMs={deadline} nowMs={now + 1000} />)
    expect(screen.getByText('1:59')).toBeInTheDocument()
  })

  it('shows "Expired" when deadline already passed', () => {
    const now = Date.now()
    render(<AcceptanceCountdown deadlineMs={now - 1000} nowMs={now} />)
    expect(screen.getByText(/expired/i)).toBeInTheDocument()
  })

  it('applies an optional className to the timer node', () => {
    const now = Date.now()
    render(<AcceptanceCountdown deadlineMs={now + 60_000} nowMs={now} className="ringNumber" />)

    expect(screen.getByText(/0:5\d|1:00/)).toHaveClass('ringNumber')
  })
})
