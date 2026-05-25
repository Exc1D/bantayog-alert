import { useEffect, useRef, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { X, ChevronRight, ChevronLeft } from 'lucide-react'
import type { OnboardingState } from '../hooks/useOnboarding'

interface Props {
  state: OnboardingState
  onNext: () => void
  onPrev: () => void
  onSkip: () => void
  onGoToStep: (index: number) => void
}

interface TargetRect {
  top: number
  left: number
  width: number
  height: number
}

export function OnboardingTour({ state, onNext, onPrev, onSkip, onGoToStep }: Props) {
  const { isActive, currentStep, steps } = state
  const [targetRect, setTargetRect] = useState<TargetRect | null>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const step = steps[currentStep]

  const updateTargetRect = useCallback(() => {
    if (!isActive || !step) return
    const el = document.querySelector(step.target)
    if (el) {
      const rect = el.getBoundingClientRect()
      setTargetRect({
        top: rect.top + window.scrollY,
        left: rect.left + window.scrollX,
        width: rect.width,
        height: rect.height,
      })
    } else {
      setTargetRect(null)
    }
  }, [isActive, step])

  useEffect(() => {
    window.addEventListener('resize', updateTargetRect)
    window.addEventListener('scroll', updateTargetRect, true)
    return () => {
      window.removeEventListener('resize', updateTargetRect)
      window.removeEventListener('scroll', updateTargetRect, true)
    }
  }, [updateTargetRect])

  // Run once on mount to get initial rect
  useEffect(() => {
    // Defer to next frame to avoid cascading render
    const id = requestAnimationFrame(() => {
      updateTargetRect()
    })
    return () => {
      cancelAnimationFrame(id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!isActive) return
    // Focus the tooltip when step changes
    tooltipRef.current?.focus()
  }, [isActive, currentStep])

  useEffect(() => {
    if (!isActive) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onSkip()
      } else if (e.key === 'ArrowRight') {
        onNext()
      } else if (e.key === 'ArrowLeft') {
        onPrev()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isActive, onNext, onPrev, onSkip])

  if (!isActive || !step) return null

  const tooltipPos = calculateTooltipPosition(targetRect, step.position)

  return createPortal(
    <>
      {/* Backdrop with cutout */}
      <div className="fixed inset-0 z-[9998] bg-black/50" aria-hidden="true">
        {targetRect && (
          <div
            className="absolute bg-transparent shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]"
            style={{
              top: targetRect.top,
              left: targetRect.left,
              width: targetRect.width,
              height: targetRect.height,
              borderRadius: '8px',
            }}
          />
        )}
      </div>

      {/* Tooltip */}
      <div
        ref={tooltipRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={`Tour step ${String(currentStep + 1)} of ${String(steps.length)}`}
        className="fixed z-[9999] w-80 rounded-lg border border-white/10 bg-[var(--color-surface-elevated)] p-4 shadow-2xl outline-none"
        style={{
          top: tooltipPos.top,
          left: tooltipPos.left,
        }}
      >
        <div className="flex items-start justify-between">
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">{step.title}</h3>
          <button
            onClick={onSkip}
            className="rounded p-1 text-[var(--color-text-muted)] hover:bg-white/10 hover:text-[var(--color-text-primary)]"
            aria-label="Skip tour"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="mt-2 text-sm text-[var(--color-text-secondary)]">{step.description}</p>

        {/* Step indicators */}
        <div className="mt-4 flex items-center justify-center gap-1.5">
          {steps.map((_, i) => (
            <button
              key={i}
              onClick={() => {
                onGoToStep(i)
              }}
              className="h-2 w-2 rounded-full transition-colors"
              style={{
                backgroundColor:
                  i === currentStep ? 'var(--color-sienna)' : 'var(--color-text-muted)',
              }}
              aria-label={`Go to step ${String(i + 1)}`}
              aria-current={i === currentStep ? 'step' : undefined}
            />
          ))}
        </div>

        {/* Navigation */}
        <div className="mt-4 flex items-center justify-between">
          <button
            onClick={onPrev}
            disabled={currentStep === 0}
            className="flex items-center gap-1 rounded px-3 py-1.5 text-sm text-[var(--color-text-secondary)] hover:bg-white/10 disabled:opacity-30"
          >
            <ChevronLeft className="h-4 w-4" />
            Back
          </button>

          <span className="text-xs text-[var(--color-text-muted)]">
            {String(currentStep + 1)} / {String(steps.length)}
          </span>

          <button
            onClick={onNext}
            className="flex items-center gap-1 rounded bg-[var(--color-sienna)] px-3 py-1.5 text-sm text-white hover:opacity-90"
          >
            {currentStep === steps.length - 1 ? 'Finish' : 'Next'}
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </>,
    document.body,
  )
}

function calculateTooltipPosition(
  targetRect: TargetRect | null,
  position: 'top' | 'bottom' | 'left' | 'right',
): { top: number; left: number } {
  if (!targetRect) return { top: 100, left: 100 }

  const tooltipWidth = 320 // w-80 = 20rem = 320px
  const tooltipHeight = 200 // approximate
  const gap = 16

  switch (position) {
    case 'bottom':
      return {
        top: targetRect.top + targetRect.height + gap,
        left: Math.max(
          16,
          Math.min(
            targetRect.left + targetRect.width / 2 - tooltipWidth / 2,
            window.innerWidth - tooltipWidth - 16,
          ),
        ),
      }
    case 'top':
      return {
        top: Math.max(16, targetRect.top - tooltipHeight - gap),
        left: Math.max(
          16,
          Math.min(
            targetRect.left + targetRect.width / 2 - tooltipWidth / 2,
            window.innerWidth - tooltipWidth - 16,
          ),
        ),
      }
    case 'left':
      return {
        top: Math.max(
          16,
          Math.min(
            targetRect.top + targetRect.height / 2 - tooltipHeight / 2,
            window.innerHeight - tooltipHeight - 16,
          ),
        ),
        left: Math.max(16, targetRect.left - tooltipWidth - gap),
      }
    case 'right':
      return {
        top: Math.max(
          16,
          Math.min(
            targetRect.top + targetRect.height / 2 - tooltipHeight / 2,
            window.innerHeight - tooltipHeight - 16,
          ),
        ),
        left: targetRect.left + targetRect.width + gap,
      }
    default:
      return { top: 100, left: 100 }
  }
}
