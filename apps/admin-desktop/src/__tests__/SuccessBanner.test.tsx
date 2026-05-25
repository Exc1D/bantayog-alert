import { describe, it, expect, vi } from 'vitest'
import { render, act } from '@testing-library/react'
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
})
