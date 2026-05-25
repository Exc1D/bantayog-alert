import { useState, useCallback } from 'react'

const STORAGE_KEY = 'bantayog.onboarding-completed'
const TOUR_VERSION = '1' // Bump to re-trigger on major UI changes

interface TourStep {
  target: string // CSS selector for the element to highlight
  title: string
  description: string
  position: 'bottom' | 'top' | 'left' | 'right'
}

export const TOUR_STEPS: TourStep[] = [
  {
    target: '[data-tour="dashboard"]',
    title: 'Dashboard',
    description:
      'Your command center. View live metrics, active alerts, and overall system status at a glance.',
    position: 'bottom',
  },
  {
    target: '[data-tour="map"]',
    title: 'Map',
    description:
      'Interactive incident map with heatmaps, responder locations, and provincial resource overlays.',
    position: 'bottom',
  },
  {
    target: '[data-tour="feed"]',
    title: 'Feed',
    description:
      'Moderation queue for incoming citizen reports. Verify, publish, or unpublish alerts here.',
    position: 'bottom',
  },
  {
    target: '[data-tour="dispatches"]',
    title: 'Dispatches',
    description:
      'Monitor and manage responder dispatches in real-time. Track fleet status and assignment history.',
    position: 'bottom',
  },
]

export interface OnboardingState {
  isActive: boolean
  currentStep: number
  steps: TourStep[]
}

export function useOnboarding() {
  const [state, setState] = useState<OnboardingState>(() => {
    const completed = localStorage.getItem(STORAGE_KEY)
    const isCompleted = completed === TOUR_VERSION
    return {
      isActive: !isCompleted,
      currentStep: 0,
      steps: TOUR_STEPS,
    }
  })

  const startTour = useCallback(() => {
    setState((prev) => ({ ...prev, isActive: true, currentStep: 0 }))
  }, [])

  const nextStep = useCallback(() => {
    setState((prev) => {
      if (prev.currentStep >= prev.steps.length - 1) {
        localStorage.setItem(STORAGE_KEY, TOUR_VERSION)
        return { ...prev, isActive: false, currentStep: 0 }
      }
      return { ...prev, currentStep: prev.currentStep + 1 }
    })
  }, [])

  const prevStep = useCallback(() => {
    setState((prev) => ({
      ...prev,
      currentStep: Math.max(0, prev.currentStep - 1),
    }))
  }, [])

  const skipTour = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, TOUR_VERSION)
    setState((prev) => ({ ...prev, isActive: false, currentStep: 0 }))
  }, [])

  const goToStep = useCallback((index: number) => {
    setState((prev) => ({
      ...prev,
      currentStep: Math.max(0, Math.min(index, prev.steps.length - 1)),
    }))
  }, [])

  const resetTour = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY)
    setState((prev) => ({ ...prev, isActive: true, currentStep: 0 }))
  }, [])

  return {
    ...state,
    startTour,
    nextStep,
    prevStep,
    skipTour,
    goToStep,
    resetTour,
  }
}
