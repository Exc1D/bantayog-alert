import { describe, it, expect, vi, afterEach } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import { AcceptanceCountdown } from './AcceptanceCountdown'

describe('AcceptanceCountdown', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('shows remaining time formatted as M:SS', () => {
    vi.useFakeTimers()
    const deadline = Date.now() + 120_000 // 2 minutes from now
    render(<AcceptanceCountdown deadlineMs={deadline} />)
    expect(screen.getByText(/1:5\d|2:00/)).toBeInTheDocument()
  })

  it('shows "Expired" when deadline already passed', () => {
    render(<AcceptanceCountdown deadlineMs={Date.now() - 1000} />)
    expect(screen.getByText(/expired/i)).toBeInTheDocument()
  })
})
