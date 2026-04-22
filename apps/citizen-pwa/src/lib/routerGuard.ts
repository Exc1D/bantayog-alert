import { useBlocker } from 'react-router-dom'
import { useUIStore } from './store'

export function useRevealGuard() {
  const { currentSheet } = useUIStore()

  return useBlocker(({ currentLocation, historyAction }) => {
    if (currentSheet !== 'none' && historyAction === 'POP') {
      const isTrackingScreen = currentLocation.pathname.startsWith('/reports/')
      if (!isTrackingScreen) {
        return true
      }
    }
    return false
  })
}