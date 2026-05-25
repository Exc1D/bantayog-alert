import { describe, it, expect, vi } from 'vitest'
import { render, act, fireEvent, screen } from '@testing-library/react'
import { SuccessBanner } from '../components/SuccessBanner'

describe('SuccessBanner', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('auto-dismisses after 4000ms', () => {
    const onDismiss = vi.fn()
    render(<SuccessBanner message="It worked!" onDismiss={onDismiss} />)

    act(() => {
      vi.advanceTimersByTime(4000)
    })

    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('clears previous timer when message changes', () => {
    const onDismiss = vi.fn()
    const { rerender } = render(<SuccessBanner message="First" onDismiss={onDismiss} />)

    rerender(<SuccessBanner message="Second" onDismiss={onDismiss} />)

    act(() => {
      vi.advanceTimersByTime(4000)
    })

    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('cancels timer on unmount', () => {
    vi.useFakeTimers()
    const onDismiss = vi.fn()
    const { unmount } = render(<SuccessBanner message="X" onDismiss={onDismiss} />)
    unmount()
    act(() => {
      vi.advanceTimersByTime(4000)
    })
    expect(onDismiss).not.toHaveBeenCalled()
    vi.useRealTimers()
  })

  it('calls onDismiss when close button is clicked', () => {
    const onDismiss = vi.fn()
    render(<SuccessBanner message="X" onDismiss={onDismiss} />)
    fireEvent.click(screen.getByLabelText('Dismiss'))
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })
})
