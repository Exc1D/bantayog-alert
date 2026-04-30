/* eslint-disable @typescript-eslint/unbound-method */
import '@testing-library/jest-dom/vitest'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { RevealSheet } from './RevealSheet'

vi.mock('../hooks/useReducedMotion', () => ({
  useReducedMotion: () => false,
}))

vi.mock('./ui/StatusBanner', () => ({
  StatusBanner: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock('./ui/Button', () => ({
  Button: ({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) => (
    <button onClick={onClick}>{children}</button>
  ),
}))

vi.mock('./ui/FallbackCards', () => ({
  FallbackCards: () => <div>Fallback</div>,
}))

vi.mock('./ui/Timeline', () => ({
  Timeline: () => <div>Timeline</div>,
}))

describe('RevealSheet', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    Object.defineProperty(navigator, 'vibrate', {
      writable: true,
      value: vi.fn(() => true),
    })
  })

  it('renders with secretCode showing upgrade prompt after typewriter', async () => {
    render(<RevealSheet state="success" referenceCode="BA-2026-001" secretCode="SECRET123" />)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1200)
    })
    expect(screen.getByText('Save your secret code to track this report')).toBeInTheDocument()
  })

  it('does not show upgrade prompt without secretCode', async () => {
    render(<RevealSheet state="success" referenceCode="BA-2026-001" />)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1200)
    })
    expect(screen.queryByText('Save your secret code to track this report')).not.toBeInTheDocument()
  })

  it('calls navigator.vibrate on typewriter complete', async () => {
    render(<RevealSheet state="success" referenceCode="BA-2026-001" />)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1200)
    })
    expect(navigator.vibrate).toHaveBeenCalledWith(200)
  })

  it('shows afterglow footer on success after typewriter', async () => {
    render(<RevealSheet state="success" referenceCode="BA-2026-001" />)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1200)
    })
    expect(screen.getByText(/Daet MDRRMO is on it/)).toBeInTheDocument()
  })
})
