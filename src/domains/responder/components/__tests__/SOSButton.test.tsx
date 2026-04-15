/**
 * SOSButton Component Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { SOSButton } from '../SOSButton'
import { useSOS } from '../../hooks/useSOS'
import { SOS_CANCELLATION_WINDOW_MS } from '../../config/urgency.config'

// ── Mock useSOS ───────────────────────────────────────────────────────────────

const activateSOSMock = vi.hoisted(() => vi.fn())
const cancelSOSMock = vi.hoisted(() => vi.fn())

vi.mock('../../hooks/useSOS', () => ({
  useSOS: vi.fn(),
}))

beforeEach(() => {
  vi.clearAllMocks()

  // Default: idle state
  ;(useSOS as ReturnType<typeof vi.fn>).mockReturnValue({
    activateSOS: activateSOSMock,
    cancelSOS: cancelSOSMock,
    sosState: null,
    error: null,
    locationSharing: false,
    canCancel: false,
  })
})

afterEach(() => {
  vi.restoreAllMocks()
})

// ── RAF mocking via vi.hoisted so tests can trigger the tick loop ──────────────
//
// The component uses requestAnimationFrame for the hold-progress animation.
// vi.useFakeTimers() does NOT reliably auto-spy RAF in jsdom, so we
// explicitly capture and invoke the callback in tests.

const savedRAFCallback = vi.hoisted(() => ({
  current: ((_cb: FrameRequestCallback): number => 0) as ((cb: FrameRequestCallback) => number) | null,
}))

const originalRAF = (() => {
  let id = 0
  return {
    start: (cb: FrameRequestCallback): number => {
      savedRAFCallback.current = cb
      return ++id
    },
    invokeAll: () => {
      const cb = savedRAFCallback.current
      if (cb) cb(performance.now())
    },
    reset: () => {
      savedRAFCallback.current = null
      id = 0
    },
  }
})()

vi.stubGlobal('requestAnimationFrame', originalRAF.start)
vi.stubGlobal('cancelAnimationFrame', vi.fn())

// ── Helpers ──────────────────────────────────────────────────────────────────

function getSOSButton(): HTMLButtonElement {
  // Use aria-label to find the SOS trigger button specifically
  const button = screen.queryByRole('button', { name: /hold for 3 seconds|sos active/i }) as HTMLButtonElement | null
  if (!button) throw new Error('SOS button not found')
  return button
}

// Advance RAF time by simulating elapsed time for the hold-progress loop.
// With the isHoldingRef pattern (holdStartRef=null, first tick sets reference),
// each hold-duration milestone requires TWO callback invocations:
//   1st: holdStartRef.current = timestamp  (elapsed = 0, progress ~0)
//   2nd: elapsed = timestamp - holdStartRef  (real elapsed computed)
function advanceHold(ms: number) {
  act(() => {
    const cb = savedRAFCallback.current
    if (!cb) return
    // First call: set the hold start reference (elapsed ≈ 0)
    const fakeNow = Date.now() + ms
    cb(fakeNow)
    // Second call: compute elapsed with reference already set
    cb(fakeNow + ms)
  })
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('SOSButton', () => {
  beforeEach(() => {
    originalRAF.reset()
  })

  describe('idle state — no active SOS', () => {
    it('should render the SOS button', () => {
      render(<SOSButton />)
      expect(getSOSButton()).toBeInTheDocument()
    })

    it('should show hold instruction aria-label', () => {
      render(<SOSButton />)
      const button = getSOSButton()
      expect(button).toHaveAttribute('aria-label', 'Hold for 3 seconds to activate SOS')
    })

    it('should not show any panel when idle', () => {
      render(<SOSButton />)
      expect(screen.queryByRole('status')).not.toBeInTheDocument()
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })

    it('should not render the cancel button when idle', () => {
      render(<SOSButton />)
      expect(screen.queryByRole('button', { name: /cancel sos/i })).not.toBeInTheDocument()
    })
  })

  describe('hold-to-activate', () => {
    it('should NOT call activateSOS when hold is released before 3 seconds', () => {
      render(<SOSButton />)
      const button = getSOSButton()

      // Simulate mousedown + 1 second hold + mouseup
      fireEvent.mouseDown(button)
      advanceHold(1_000)
      fireEvent.mouseUp(button)

      expect(activateSOSMock).not.toHaveBeenCalled()
    })

    it('should call activateSOS after holding for 3 seconds', () => {
      render(<SOSButton />)
      const button = getSOSButton()

      fireEvent.mouseDown(button)
      advanceHold(3_000)

      expect(activateSOSMock).toHaveBeenCalledTimes(1)
    })

    it('should cancel hold progress on mouseLeave', () => {
      render(<SOSButton />)
      const button = getSOSButton()

      fireEvent.mouseDown(button)
      advanceHold(1_500)
      fireEvent.mouseLeave(button)

      // Advance past 3s — should NOT activate since hold was cancelled
      advanceHold(2_000)

      expect(activateSOSMock).not.toHaveBeenCalled()
    })

    it('should support touch events (touchstart)', () => {
      render(<SOSButton />)
      const button = getSOSButton()

      fireEvent.touchStart(button)
      advanceHold(3_000)

      expect(activateSOSMock).toHaveBeenCalledTimes(1)
    })

    it('should cancel hold progress on touchEnd', () => {
      render(<SOSButton />)
      const button = getSOSButton()

      fireEvent.touchStart(button)
      advanceHold(1_500)
      fireEvent.touchEnd(button)

      advanceHold(2_000)

      expect(activateSOSMock).not.toHaveBeenCalled()
    })

    it('should call activateSOS after holding Enter for 3 seconds', () => {
      render(<SOSButton />)
      const button = getSOSButton()

      fireEvent.keyDown(button, { key: 'Enter', code: 'Enter' })
      advanceHold(3_000)

      expect(activateSOSMock).toHaveBeenCalledTimes(1)
    })

    it('should call activateSOS after holding Space for 3 seconds', () => {
      render(<SOSButton />)
      const button = getSOSButton()

      fireEvent.keyDown(button, { key: ' ', code: 'Space' })
      advanceHold(3_000)

      expect(activateSOSMock).toHaveBeenCalledTimes(1)
    })

    it('should cancel hold on Space keyUp before 3 seconds', () => {
      render(<SOSButton />)
      const button = getSOSButton()

      fireEvent.keyDown(button, { key: ' ', code: 'Space' })
      advanceHold(1_500)
      fireEvent.keyUp(button, { key: ' ', code: 'Space' })

      // activateSOS was NOT called — hold was cancelled before 3s
      expect(activateSOSMock).not.toHaveBeenCalled()
    })

    it('should clean up RAF on unmount while hold is active', () => {
      const cancelSpy = vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(vi.fn())

      const { unmount } = render(<SOSButton />)
      const button = getSOSButton()

      fireEvent.mouseDown(button)
      advanceHold(1_000)

      // Unmount while hold is active — cleanup should cancel the RAF
      unmount()

      expect(cancelSpy).toHaveBeenCalled()

      cancelSpy.mockRestore()
    })

    it('should disable button when SOS is already active', () => {
      ;(useSOS as ReturnType<typeof vi.fn>).mockReturnValue({
        activateSOS: activateSOSMock,
        cancelSOS: cancelSOSMock,
        sosState: {
          id: 'sos-1',
          status: 'active',
          responderId: 'r-1',
          activatedAt: Date.now(),
          expiresAt: Date.now() + 4 * 3600 * 1000,
          cancellationWindowEndsAt: Date.now() + SOS_CANCELLATION_WINDOW_MS,
          location: { latitude: 14.2972, longitude: 122.7417, accuracy: 10, altitude: null, altitudeAccuracy: null, heading: null, speed: null, timestamp: Date.now(), source: 'gps' },
        },
        error: null,
        locationSharing: true,
        canCancel: true,
      })

      render(<SOSButton />)

      // SOS button is disabled; find it by aria-label
      const button = screen.getByRole('button', { name: /sos active/i })
      expect(button).toBeDisabled()
      expect(button).toHaveAttribute('aria-label', 'SOS active — hold disabled')
    })
  })

  describe('active state — SOS activated', () => {
    function mockActiveState(overrides: Partial<ReturnType<typeof useSOS>> = {}) {
      ;(useSOS as ReturnType<typeof vi.fn>).mockReturnValue({
        activateSOS: activateSOSMock,
        cancelSOS: cancelSOSMock,
        sosState: {
          id: 'sos-1',
          status: 'active',
          responderId: 'r-1',
          activatedAt: Date.now(),
          expiresAt: Date.now() + 4 * 3600 * 1000,
          cancellationWindowEndsAt: Date.now() + SOS_CANCELLATION_WINDOW_MS,
          location: { latitude: 14.2972, longitude: 122.7417, accuracy: 10, altitude: null, altitudeAccuracy: null, heading: null, speed: null, timestamp: Date.now(), source: 'gps' },
        },
        error: null,
        locationSharing: false,
        canCancel: true,
        ...overrides,
      })
    }

    it('should show activated confirmation panel', () => {
      mockActiveState()

      render(<SOSButton />)

      expect(screen.getByRole('status')).toBeInTheDocument()
      expect(screen.getByRole('status')).toHaveTextContent(/sos activated/i)
    })

    it('should display location coordinates', () => {
      mockActiveState()

      render(<SOSButton />)

      expect(screen.getByText(/14\.29720/i)).toBeInTheDocument()
      expect(screen.getByText(/122\.74170/i)).toBeInTheDocument()
    })

    it('should show Cancel SOS button when canCancel is true', () => {
      mockActiveState({ canCancel: true })

      render(<SOSButton />)

      expect(screen.getByRole('button', { name: /cancel sos/i })).toBeInTheDocument()
    })

    it('should NOT show Cancel SOS button when canCancel is false', () => {
      mockActiveState({ canCancel: false })

      render(<SOSButton />)

      expect(screen.queryByRole('button', { name: /cancel sos/i })).not.toBeInTheDocument()
      expect(screen.getByText(/cancellation window closed/i)).toBeInTheDocument()
    })

    it('should show location sharing status', () => {
      mockActiveState({ locationSharing: true })

      render(<SOSButton />)

      expect(screen.getByText(/live gps: sharing/i)).toBeInTheDocument()
    })

    it('should call cancelSOS when Cancel button is clicked and confirmed', () => {
      mockActiveState({ canCancel: true })

      // Mock window.confirm to return true
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)

      render(<SOSButton />)

      fireEvent.click(screen.getByRole('button', { name: /cancel sos/i }))

      expect(confirmSpy).toHaveBeenCalledWith('Are you sure? This is an emergency.')
      expect(cancelSOSMock).toHaveBeenCalledWith('False alarm / accidental activation')

      confirmSpy.mockRestore()
    })

    it('should NOT call cancelSOS when confirm is dismissed', () => {
      mockActiveState({ canCancel: true })

      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)
      const alertSpy = vi.spyOn(window, 'alert').mockImplementation(vi.fn())

      render(<SOSButton />)

      fireEvent.click(screen.getByRole('button', { name: /cancel sos/i }))

      expect(cancelSOSMock).not.toHaveBeenCalled()
      expect(alertSpy).toHaveBeenCalledWith('SOS cancellation kept. Your emergency signal remains active.')

      confirmSpy.mockRestore()
      alertSpy.mockRestore()
    })
  })

  describe('cancelled state', () => {
    it('should show cancelled panel with reason', () => {
      ;(useSOS as ReturnType<typeof vi.fn>).mockReturnValue({
        activateSOS: activateSOSMock,
        cancelSOS: cancelSOSMock,
        sosState: {
          id: 'sos-1',
          status: 'cancelled',
          responderId: 'r-1',
          activatedAt: Date.now() - 60_000,
          expiresAt: Date.now() + 4 * 3600 * 1000,
          cancellationWindowEndsAt: Date.now() - 30_000,
          cancelledAt: Date.now(),
          cancellationReason: 'False alarm',
        },
        error: null,
        locationSharing: false,
        canCancel: false,
      })

      render(<SOSButton />)

      const statusEl = screen.getByRole('status')
      expect(statusEl).toHaveTextContent(/sos cancelled/i)
      expect(statusEl).toHaveTextContent(/false alarm/i)
    })

    it('should not show SOS button when status is cancelled', () => {
      ;(useSOS as ReturnType<typeof vi.fn>).mockReturnValue({
        activateSOS: activateSOSMock,
        cancelSOS: cancelSOSMock,
        sosState: {
          id: 'sos-1',
          status: 'cancelled',
          responderId: 'r-1',
          activatedAt: Date.now() - 60_000,
          expiresAt: Date.now() + 4 * 3600 * 1000,
          cancellationWindowEndsAt: Date.now() - 30_000,
          cancelledAt: Date.now(),
        },
        error: null,
        locationSharing: false,
        canCancel: false,
      })

      render(<SOSButton />)

      expect(screen.queryByRole('button', { name: /hold for 3 seconds/i })).not.toBeInTheDocument()
    })
  })

  describe('error state', () => {
    it('should display error message from useSOS', () => {
      ;(useSOS as ReturnType<typeof vi.fn>).mockReturnValue({
        activateSOS: activateSOSMock,
        cancelSOS: cancelSOSMock,
        sosState: null,
        error: { code: 'GPS_TIMEOUT', message: 'Unable to get your location.' },
        locationSharing: false,
        canCancel: false,
      })

      render(<SOSButton />)

      const alertEl = screen.getByRole('alert')
      expect(alertEl).toHaveTextContent(/sos error/i)
      expect(alertEl).toHaveTextContent(/unable to get your location/i)
    })

    it('should display SOS_OFFLINE error', () => {
      ;(useSOS as ReturnType<typeof vi.fn>).mockReturnValue({
        activateSOS: activateSOSMock,
        cancelSOS: cancelSOSMock,
        sosState: null,
        error: { code: 'SOS_OFFLINE', message: 'SOS activation requires internet connection.' },
        locationSharing: false,
        canCancel: false,
      })

      render(<SOSButton />)

      expect(screen.getByRole('alert')).toHaveTextContent(/sos activation requires internet connection/i)
    })
  })

  describe('className prop', () => {
    it('should forward className to wrapper div', () => {
      render(<SOSButton className="absolute top-4 right-4" />)
      // The outer wrapper is the div with className
      const wrapper = document.querySelector('.inline-flex.flex-col.items-end.gap-2.absolute.top-4.right-4')
      expect(wrapper).toBeTruthy()
    })
  })

  describe('location unavailable', () => {
    it('should show fallback text when sosState has no location', () => {
      ;(useSOS as ReturnType<typeof vi.fn>).mockReturnValue({
        activateSOS: activateSOSMock,
        cancelSOS: cancelSOSMock,
        sosState: {
          id: 'sos-1',
          status: 'active',
          responderId: 'r-1',
          activatedAt: Date.now(),
          expiresAt: Date.now() + 4 * 3600 * 1000,
          cancellationWindowEndsAt: Date.now() + SOS_CANCELLATION_WINDOW_MS,
          // no location field
        },
        error: null,
        locationSharing: false,
        canCancel: true,
      })

      render(<SOSButton />)

      expect(screen.getByText(/location unavailable/i)).toBeInTheDocument()
    })
  })
})
