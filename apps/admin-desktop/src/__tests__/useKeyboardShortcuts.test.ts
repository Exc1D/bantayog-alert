import { describe, it, expect, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts'

describe('useKeyboardShortcuts', () => {
  it('calls handler on matching key', () => {
    const handler = vi.fn()
    renderHook(() => {
      useKeyboardShortcuts([{ key: 'v', handler }])
    })
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'v' }))
    expect(handler).toHaveBeenCalled()
  })

  it('ignores keys when input is focused', () => {
    const handler = vi.fn()
    renderHook(() => {
      useKeyboardShortcuts([{ key: 'v', handler }])
    })
    const input = document.createElement('input')
    document.body.appendChild(input)
    input.focus()
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'v' }))
    expect(handler).not.toHaveBeenCalled()
    document.body.removeChild(input)
  })
})
