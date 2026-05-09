import { useEffect, useState } from 'react'

type UseStaleDataOptions = number | { staleThresholdMs?: number }

export interface StaleDataState {
  isStale: boolean
  secondsSinceUpdate: number
  markFresh: () => void
}

export function useStaleData(options: UseStaleDataOptions = {}): StaleDataState {
  const staleThresholdMs =
    typeof options === 'number' ? options : (options.staleThresholdMs ?? 60000)
  const [isStale, setIsStale] = useState(false)
  const [secondsSinceUpdate, setSecondsSinceUpdate] = useState(0)
  // Lazy initializer runs once on mount, not on every render
  const [lastUpdate, setLastUpdate] = useState(() => Date.now())

  const markFresh = () => {
    // Event handlers are allowed to call impure functions
    setLastUpdate(Date.now())
    setSecondsSinceUpdate(0)
    setIsStale(false)
  }

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      const now = Date.now()
      const elapsed = now - lastUpdate
      const seconds = Math.floor(elapsed / 1000)

      setSecondsSinceUpdate(seconds)

      if (elapsed >= staleThresholdMs && !isStale) {
        setIsStale(true)
      } else if (elapsed < staleThresholdMs && isStale) {
        setIsStale(false)
      }
    }, 1000)

    return () => {
      clearInterval(intervalId)
    }
  }, [staleThresholdMs, isStale, lastUpdate])

  return { isStale, secondsSinceUpdate, markFresh }
}
