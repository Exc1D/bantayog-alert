import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AgeGate } from '../AgeGate'

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {}

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString()
    },
    clear: () => {
      store = {}
    },
    removeItem: (key: string) => {
      delete store[key]
    },
  }
})()

Object.defineProperty(global, 'localStorage', {
  value: localStorageMock,
})

describe('AgeGate', () => {
  beforeEach(() => {
    localStorage.clear()
  })
  it('should display age verification message', () => {
    render(<AgeGate onVerified={vi.fn()} />)

    expect(screen.getByText(/must be 13/i)).toBeInTheDocument()
  })

  it('should call onVerified when checkbox is checked and continue is clicked', async () => {
    const user = userEvent.setup()
    const onVerified = vi.fn()

    render(<AgeGate onVerified={onVerified} />)

    await user.click(screen.getByLabelText(/i am 13/i))
    await user.click(screen.getByRole('button', { name: /continue/i }))

    expect(onVerified).toHaveBeenCalledOnce()
  })

  it('should not call onVerified if checkbox is not checked', async () => {
    const user = userEvent.setup()
    const onVerified = vi.fn()

    render(<AgeGate onVerified={onVerified} />)

    await user.click(screen.getByRole('button', { name: /continue/i }))

    expect(onVerified).not.toHaveBeenCalled()
  })

  it('should not show again once verified (localStorage)', () => {
    localStorage.setItem('age_verified', 'true')

    render(<AgeGate onVerified={vi.fn()} />)

    // Should not render the gate if already verified
    expect(screen.queryByText(/must be 13 or older/i)).not.toBeInTheDocument()

    localStorage.removeItem('age_verified')
  })

  it('should call onVerified on mount when already verified', () => {
    localStorage.setItem('age_verified', 'true')
    const onVerified = vi.fn()

    render(<AgeGate onVerified={onVerified} />)

    // onVerified should be called when mount with existing verification
    expect(onVerified).toHaveBeenCalledTimes(1)

    localStorage.removeItem('age_verified')
  })
})
