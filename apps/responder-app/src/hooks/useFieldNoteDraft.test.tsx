import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const storage = vi.hoisted(() => ({
  value: null as string | null,
  get: vi.fn(() => Promise.resolve({ value: storage.value })),
  set: vi.fn((entry: { key: string; value: string }) => {
    storage.value = entry.value
    return Promise.resolve()
  }),
  remove: vi.fn(() => {
    storage.value = null
    return Promise.resolve()
  }),
}))

vi.mock('@capacitor/preferences', () => ({
  Preferences: storage,
}))

import { useFieldNoteDraft } from './useFieldNoteDraft'

describe('useFieldNoteDraft', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    storage.value = 'saved draft'
    storage.get.mockClear()
    storage.set.mockClear()
    storage.remove.mockClear()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('restores draft on mount and debounces saves', async () => {
    const { result } = renderHook(() => useFieldNoteDraft('dispatch-1'))

    expect(result.current.loaded).toBe(false)

    await act(async () => {
      await Promise.resolve()
    })

    expect(result.current.loaded).toBe(true)
    expect(result.current.value).toBe('saved draft')

    act(() => {
      vi.advanceTimersByTime(500)
    })

    expect(storage.set).not.toHaveBeenCalled()

    await act(async () => {
      result.current.setValue('new draft')
      await Promise.resolve()
    })

    storage.set.mockClear()

    act(() => {
      vi.advanceTimersByTime(500)
    })

    expect(storage.set).toHaveBeenCalledWith({ key: 'field-notes/dispatch-1', value: 'new draft' })
  })

  it('does not overwrite a user edit when hydration settles later', async () => {
    let resolveGet: ((entry: { value: string | null }) => void) | undefined
    storage.get.mockImplementationOnce(
      () =>
        new Promise((resolve: (entry: { value: string | null }) => void) => {
          resolveGet = resolve
        }),
    )

    const { result } = renderHook(() => useFieldNoteDraft('dispatch-1'))

    act(() => {
      result.current.setValue('typed first')
    })

    expect(result.current.value).toBe('typed first')

    await act(async () => {
      resolveGet?.({ value: 'saved draft' })
      await Promise.resolve()
    })

    expect(result.current.loaded).toBe(true)
    expect(result.current.value).toBe('typed first')
  })

  it('clears draft after submit', async () => {
    const { result } = renderHook(() => useFieldNoteDraft('dispatch-1'))

    await act(async () => {
      await result.current.clear()
    })

    expect(storage.remove).toHaveBeenCalledWith({ key: 'field-notes/dispatch-1' })
  })
})
