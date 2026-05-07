import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async (importOriginal) => {
  const original = await importOriginal<typeof import('react-router-dom')>()
  return {
    ...original,
    useNavigate: () => mockNavigate,
  }
})

vi.mock('../app/firebase', () => ({ db: {} }))
vi.mock('firebase/firestore', () => ({
  onSnapshot: vi.fn(() => vi.fn()),
  collection: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
}))
vi.mock('@bantayog/shared-ui', () => ({
  useAuth: () => ({
    user: { uid: 'sa-1' },
    claims: { role: 'provincial_superadmin' },
    loading: false,
    signOut: vi.fn(),
  }),
}))
vi.mock('../services/callables', () => ({ callables: {} }))

import { ShellKeyboardShortcuts } from '../components/ShellKeyboardShortcuts'

describe('ShellKeyboardShortcuts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  it('pressing N navigates to /province/ndrrmc', () => {
    render(
      <MemoryRouter>
        <ShellKeyboardShortcuts />
      </MemoryRouter>,
    )
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'n' }))
    expect(mockNavigate).toHaveBeenCalledWith('/province/ndrrmc')
  })

  it('pressing A navigates to /province/emergency', () => {
    render(
      <MemoryRouter>
        <ShellKeyboardShortcuts />
      </MemoryRouter>,
    )
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }))
    expect(mockNavigate).toHaveBeenCalledWith('/province/emergency')
  })

  it('does not navigate when focus is on an input element', () => {
    render(
      <MemoryRouter>
        <input data-testid="focused-input" />
        <ShellKeyboardShortcuts />
      </MemoryRouter>,
    )
    const input = document.querySelector('input')
    if (input) {
      Object.defineProperty(document, 'activeElement', { value: input, configurable: true })
    }
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'n' }))
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it('does not navigate when focus is on a textarea element', () => {
    render(
      <MemoryRouter>
        <textarea data-testid="focused-textarea" />
        <ShellKeyboardShortcuts />
      </MemoryRouter>,
    )
    const textarea = document.querySelector('textarea')
    if (textarea) {
      Object.defineProperty(document, 'activeElement', {
        value: textarea,
        configurable: true,
      })
    }
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }))
    expect(mockNavigate).not.toHaveBeenCalled()
  })
})
