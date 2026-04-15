/**
 * SOSButton Component — Responder Emergency SOS Activation
 *
 * Self-contained component that calls useSOS() internally.
 * Hold for 3 seconds to activate SOS emergency signal.
 * Shows cancellation UI within the 30-second cancellation window.
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { useSOS } from '../hooks/useSOS'
import { Button } from '@/shared/components/Button'

/** Hold duration required to activate SOS (3 seconds) */
const HOLD_TO_ACTIVATE_MS = 3_000

interface SOSButtonProps {
  /** Optional className forwarded to the button wrapper */
  className?: string
}

/**
 * SOSButton — emergency distress signal trigger.
 *
 * States:
 *  - idle:          Default — shows 🆘 button
 *  - activating:    User is holding — shows filling progress ring
 *  - active:        SOS sent — shows confirmation panel with location + cancel
 *  - cancelled:     SOS was cancelled — brief confirmation then idle
 */
export function SOSButton({ className = '' }: SOSButtonProps) {
  const { activateSOS, cancelSOS, sosState, error, locationSharing, canCancel } = useSOS()

  // ── Hold-to-activate state ───────────────────────────────────────────────
  const [holdProgress, setHoldProgress] = useState(0)   // 0–100
  const [isHolding, setIsHolding] = useState(false)

  const holdStartRef = useRef<number | null>(null)
  const rafRef = useRef<number | null>(null)

  /** Start the hold progress animation */
  const startHold = useCallback(() => {
    if (sosState) return  // Don't start hold if SOS is already active
    setIsHolding(true)
    holdStartRef.current = Date.now()

    const tick = (timestamp: number) => {
      // Use a fixed base for elapsed time so the animation is consistent
      const elapsed = (timestamp - (holdStartRef.current ?? timestamp))
      const progress = Math.min((elapsed / HOLD_TO_ACTIVATE_MS) * 100, 100)
      setHoldProgress(progress)

      if (progress >= 100) {
        // Activation threshold reached
        activateSOS()
        setIsHolding(false)
        setHoldProgress(0)
        holdStartRef.current = null
        return
      }

      if (isHolding) {
        rafRef.current = requestAnimationFrame(tick)
      }
    }

    rafRef.current = requestAnimationFrame(tick)
  }, [isHolding, sosState, activateSOS])

  /** Cancel the hold progress */
  const cancelHold = useCallback(() => {
    if (!isHolding) return
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    setIsHolding(false)
    setHoldProgress(0)
    holdStartRef.current = null
  }, [isHolding])

  // ── Cleanup on unmount ────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    }
  }, [])

  // ── Handle cancel confirmation ────────────────────────────────────────────
  const handleCancelSOS = useCallback(() => {
    if (typeof window === 'undefined' || typeof window.confirm !== 'function') {
      // SSR or feature-blocked environment — proceed without guard
      cancelSOS('False alarm / accidental activation')
      return
    }

    const confirmed = window.confirm('Are you sure? This is an emergency.')
    if (confirmed) {
      cancelSOS('False alarm / accidental activation')
    } else {
      // User explicitly dismissed — give feedback so they know the button worked
      alert('SOS cancellation kept. Your emergency signal remains active.')
    }
  }, [cancelSOS])

  // ── Circle progress math ──────────────────────────────────────────────────
  const RADIUS = 18
  const CIRCUMFERENCE = 2 * Math.PI * RADIUS
  const strokeDashoffset = CIRCUMFERENCE * (1 - holdProgress / 100)

  // ── Location display text ────────────────────────────────────────────────
  const locationText = sosState?.location
    ? `${sosState.location.latitude.toFixed(5)}, ${sosState.location.longitude.toFixed(5)}`
    : 'Location unavailable'

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className={`inline-flex flex-col items-end gap-2 ${className}`}>

      {/* Activated confirmation panel */}
      {sosState?.status === 'active' && (
        <div
          className="bg-white border-2 border-red-500 rounded-xl shadow-2xl p-4 w-72 animate-in fade-in zoom-in-95 duration-200"
          role="status"
          aria-live="polite"
        >
          {/* Header */}
          <div className="flex items-center gap-2 mb-3">
            <span className="text-2xl" aria-hidden="true">&#x1F6A8;</span>
            <span className="text-red-600 font-bold text-base uppercase tracking-wide">
              SOS Activated
            </span>
          </div>

          {/* Message */}
          <p className="text-sm text-gray-700 mb-3">
            Emergency signal sent to all admins.
          </p>

          {/* Location */}
          <div className="bg-red-50 rounded-lg p-2 mb-2">
            <p className="text-xs text-red-500 font-medium mb-0.5">Your location</p>
            <p className="text-sm text-gray-800 font-mono">{locationText}</p>
          </div>

          {/* Status info */}
          <div className="flex items-center justify-between text-xs text-gray-500 mb-3">
            <span>Live GPS: {locationSharing ? 'Sharing' : 'Stopped'}</span>
            {canCancel ? (
              <span className="text-amber-600 font-medium">
                Cancel window open
              </span>
            ) : (
              <span className="text-gray-400">Cancel window closed</span>
            )}
          </div>

          {/* Stay safe message */}
          <p className="text-sm text-gray-600 italic mb-3">
            Stay where you are. Help is coming.
          </p>

          {/* Cancel button — only when canCancel */}
          {canCancel ? (
            <Button
              variant="outline"
              size="sm"
              className="w-full border-red-400 text-red-600 hover:bg-red-50"
              onClick={handleCancelSOS}
            >
              Cancel SOS
            </Button>
          ) : (
            <p className="text-xs text-gray-400 text-center">
              Cancellation window closed — admins have been notified
            </p>
          )}
        </div>
      )}

      {/* Cancelled confirmation */}
      {sosState?.status === 'cancelled' && (
        <div
          className="bg-white border border-gray-300 rounded-xl shadow p-4 w-64"
          role="status"
          aria-live="polite"
        >
          <p className="text-sm text-gray-700 font-medium">SOS Cancelled</p>
          <p className="text-xs text-gray-500 mt-1">
            {sosState.cancellationReason ?? 'No reason provided'}
          </p>
        </div>
      )}

      {/* Error display */}
      {error && (
        <div
          className="bg-white border border-red-300 rounded-lg p-3 w-64 shadow"
          role="alert"
          aria-live="assertive"
        >
          <p className="text-sm text-red-600 font-medium">SOS Error</p>
          <p className="text-xs text-red-500 mt-1">{error.message}</p>
        </div>
      )}

      {/* The SOS button itself — always visible unless confirmed cancelled */}
      {sosState?.status !== 'cancelled' && (
        <div className="relative inline-flex items-center justify-center">
          {/* Progress ring SVG */}
          <svg
            className="absolute inset-0 w-full h-full"
            width="52"
            height="52"
            viewBox="0 0 52 52"
            aria-hidden="true"
          >
            {/* Background track */}
            <circle
              cx="26"
              cy="26"
              r={RADIUS}
              fill="none"
              stroke="rgba(255,255,255,0.3)"
              strokeWidth="3"
            />
            {/* Progress arc */}
            <circle
              cx="26"
              cy="26"
              r={RADIUS}
              fill="none"
              stroke="#ffffff"
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={strokeDashoffset}
              transform="rotate(-90 26 26)"
              style={{ transition: 'stroke-dashoffset 0.05s linear' }}
            />
          </svg>

          {/* Button */}
          <button
            type="button"
            className={[
              'relative z-10 w-12 h-12 rounded-full flex items-center justify-center',
              'text-white font-bold text-lg select-none',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-red-700',
              'transition-colors duration-150',
              isHolding
                ? 'bg-red-700'
                : sosState?.status === 'active'
                  ? 'bg-red-400 cursor-default'
                  : 'bg-primary-red hover:bg-red-700 active:bg-red-800',
            ].join(' ')}
            onMouseDown={startHold}
            onMouseUp={cancelHold}
            onMouseLeave={cancelHold}
            onTouchStart={startHold}
            onTouchEnd={cancelHold}
            onTouchCancel={cancelHold}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                activateSOS()
              }
            }}
            onKeyUp={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                cancelHold()
              }
            }}
            disabled={sosState?.status === 'active'}
            aria-label={
              sosState?.status === 'active'
                ? 'SOS active — hold disabled'
                : isHolding
                  ? 'Hold to activate SOS — in progress'
                  : 'Hold for 3 seconds to activate SOS'
            }
            aria-pressed={sosState?.status === 'active'}
          >
            {/* Pulsing ring animation when active */}
            {sosState?.status === 'active' ? (
              <span className="relative flex h-4 w-4">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
                <span className="relative inline-flex rounded-full h-4 w-4 bg-white" />
              </span>
            ) : (
              '🚨'
            )}
          </button>
        </div>
      )}
    </div>
  )
}
