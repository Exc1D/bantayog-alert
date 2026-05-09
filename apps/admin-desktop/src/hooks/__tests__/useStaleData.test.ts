import { renderHook, act } from '@testing-library/react'
import { useStaleData } from '../useStaleData'

describe('useStaleData', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should initialize as fresh', () => {
    const { result } = renderHook(() => useStaleData())
    expect(result.current.isStale).toBe(false)
    expect(result.current.secondsSinceUpdate).toBe(0)
  })

  it('should become stale after 60 seconds', () => {
    const { result } = renderHook(() => useStaleData(60000)) // 60s threshold

    act(() => {
      vi.advanceTimersByTime(59000)
    })
    expect(result.current.isStale).toBe(false)

    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(result.current.isStale).toBe(true)
  })

  it('should reset staleness on markFresh call', () => {
    const { result } = renderHook(() => useStaleData(60000))

    act(() => {
      vi.advanceTimersByTime(61000)
    })
    expect(result.current.isStale).toBe(true)

    act(() => {
      result.current.markFresh()
    })
    expect(result.current.isStale).toBe(false)
    expect(result.current.secondsSinceUpdate).toBe(0)
  })

  it('should report seconds since update', () => {
    const { result } = renderHook(() => useStaleData())

    act(() => {
      vi.advanceTimersByTime(30000)
    })
    expect(result.current.secondsSinceUpdate).toBe(30)
  })
})
