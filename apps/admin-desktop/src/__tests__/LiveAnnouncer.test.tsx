import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act, cleanup } from '@testing-library/react'
import { LiveAnnouncer, announce } from '../components/LiveAnnouncer'

describe('LiveAnnouncer', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    cleanup()
    vi.runOnlyPendingTimers()
    vi.useRealTimers()
  })

  it('renders aria-live region', () => {
    render(<LiveAnnouncer />)
    const region = screen.getByRole('status')
    expect(region).toHaveAttribute('aria-live', 'polite')
    expect(region).toHaveAttribute('aria-atomic', 'true')
    expect(region).toHaveClass('sr-only')
  })

  it('announces messages', () => {
    render(<LiveAnnouncer />)
    act(() => {
      announce('New alert received')
    })
    act(() => {
      vi.advanceTimersByTime(0)
    })
    const region = screen.getByRole('status')
    expect(region).toHaveTextContent('New alert received')
  })

  it('rate-limits announcements to minimum 3 seconds between', () => {
    render(<LiveAnnouncer />)

    act(() => {
      announce('First message')
    })
    act(() => {
      vi.advanceTimersByTime(0)
    })
    const region = screen.getByRole('status')
    expect(region).toHaveTextContent('First message')

    // Immediately announce second message — should be queued
    act(() => {
      announce('Second message')
    })
    // Should still show first message since we're within the rate limit
    expect(region).toHaveTextContent('First message')

    // Advance past the 3 second minimum interval
    act(() => {
      vi.advanceTimersByTime(3000)
    })
    expect(region).toHaveTextContent('Second message')
  })

  it('combines queued messages with period separator', () => {
    render(<LiveAnnouncer />)

    act(() => {
      announce('Message one')
      announce('Message two')
    })
    act(() => {
      vi.advanceTimersByTime(0)
    })

    const region = screen.getByRole('status')
    expect(region).toHaveTextContent('Message one. Message two')
  })
})
