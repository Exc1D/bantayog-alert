import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useOnboarding, TOUR_STEPS } from './useOnboarding'

describe('useOnboarding', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('starts active when no completion marker exists', () => {
    const { result } = renderHook(() => useOnboarding())
    expect(result.current.isActive).toBe(true)
    expect(result.current.currentStep).toBe(0)
  })

  it('starts inactive when already completed', () => {
    localStorage.setItem('bantayog.onboarding-completed', '1')
    const { result } = renderHook(() => useOnboarding())
    expect(result.current.isActive).toBe(false)
  })

  it('advances to next step', () => {
    const { result } = renderHook(() => useOnboarding())

    act(() => {
      result.current.nextStep()
    })

    expect(result.current.currentStep).toBe(1)
  })

  it('goes back to previous step', () => {
    const { result } = renderHook(() => useOnboarding())

    act(() => {
      result.current.nextStep()
    })
    act(() => {
      result.current.prevStep()
    })

    expect(result.current.currentStep).toBe(0)
  })

  it('cannot go below step 0', () => {
    const { result } = renderHook(() => useOnboarding())

    act(() => {
      result.current.prevStep()
    })

    expect(result.current.currentStep).toBe(0)
  })

  it('completes tour on last step next', () => {
    const { result } = renderHook(() => useOnboarding())

    // Advance through all steps
    Array.from({ length: TOUR_STEPS.length }).forEach(() => {
      act(() => {
        result.current.nextStep()
      })
    })

    expect(result.current.isActive).toBe(false)
    expect(localStorage.getItem('bantayog.onboarding-completed')).toBe('1')
  })

  it('skips tour and persists', () => {
    const { result } = renderHook(() => useOnboarding())

    act(() => {
      result.current.skipTour()
    })

    expect(result.current.isActive).toBe(false)
    expect(localStorage.getItem('bantayog.onboarding-completed')).toBe('1')
  })

  it('resets tour', () => {
    localStorage.setItem('bantayog.onboarding-completed', '1')
    const { result } = renderHook(() => useOnboarding())

    act(() => {
      result.current.resetTour()
    })

    expect(result.current.isActive).toBe(true)
    expect(result.current.currentStep).toBe(0)
    expect(localStorage.getItem('bantayog.onboarding-completed')).toBeNull()
  })

  it('goes to specific step', () => {
    const { result } = renderHook(() => useOnboarding())

    act(() => {
      result.current.goToStep(2)
    })

    expect(result.current.currentStep).toBe(2)
  })

  it('clamps goToStep to valid range', () => {
    const { result } = renderHook(() => useOnboarding())

    act(() => {
      result.current.goToStep(99)
    })

    expect(result.current.currentStep).toBe(TOUR_STEPS.length - 1)
  })

  it('starts tour manually', () => {
    localStorage.setItem('bantayog.onboarding-completed', '1')
    const { result } = renderHook(() => useOnboarding())

    act(() => {
      result.current.startTour()
    })

    expect(result.current.isActive).toBe(true)
    expect(result.current.currentStep).toBe(0)
  })
})
