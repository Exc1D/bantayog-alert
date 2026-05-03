import '@testing-library/jest-dom/vitest'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { RevealSheet } from './RevealSheet'

vi.mock('../services/firebase.js', () => ({
  auth: vi.fn(),
  hasFirebaseConfig: () => false,
}))

vi.mock('firebase/auth', () => ({
  onAuthStateChanged: vi.fn(),
}))

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
}))

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

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders secret code section after typewriter', async () => {
    render(<RevealSheet state="success" referenceCode="BA-2026-001" secretCode="SECRET123" />)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1200)
    })
    expect(screen.getByText('Secret Code')).toBeInTheDocument()
    expect(screen.getByText('SHOWN ONCE')).toBeInTheDocument()
    expect(screen.getByText('SECRET123')).toBeInTheDocument()
  })

  it('does not show secret code section without secretCode', async () => {
    render(<RevealSheet state="success" referenceCode="BA-2026-001" />)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1200)
    })
    expect(screen.queryByText('Secret Code')).not.toBeInTheDocument()
  })

  it('calls navigator.vibrate with correct pattern on success mount', () => {
    render(<RevealSheet state="success" referenceCode="BA-2026-001" />)
    expect(navigator.vibrate).toHaveBeenCalledWith([15, 80, 25])
  })

  it('shows afterglow footer on success after typewriter', async () => {
    render(<RevealSheet state="success" referenceCode="BA-2026-001" />)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1200)
    })
    expect(screen.getByText(/Daet MDRRMO is on it/)).toBeInTheDocument()
  })

  it('shows Guardian invitation for unregistered users on success', async () => {
    render(<RevealSheet state="success" referenceCode="BA-2026-001" />)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1200)
    })
    expect(screen.getByText(/Maging Guardian/)).toBeInTheDocument()
    expect(screen.getByText(/Create Account/)).toBeInTheDocument()
  })
})
