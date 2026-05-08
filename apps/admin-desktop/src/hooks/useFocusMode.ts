import { useState, useEffect, useCallback } from 'react'

export type FocusZone = 'map' | 'grid'

export function useFocusMode() {
  const [focusedZone, setFocusedZone] = useState<FocusZone | null>(null)

  const enterFocusMode = useCallback((zone: FocusZone) => {
    setFocusedZone(zone)
  }, [])

  const exitFocusMode = useCallback(() => {
    setFocusedZone(null)
  }, [])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        exitFocusMode()
        return
      }

      if (event.altKey) {
        if (event.key === '1') {
          event.preventDefault()
          enterFocusMode('map')
        } else if (event.key === '2') {
          event.preventDefault()
          enterFocusMode('grid')
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [enterFocusMode, exitFocusMode])

  return {
    focusedZone,
    isFocusModeActive: focusedZone !== null,
    enterFocusMode,
    exitFocusMode,
  }
}
