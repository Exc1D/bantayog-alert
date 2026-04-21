import { useBlocker } from 'react-router-dom'
import { useUIStore } from './store'

export function useRevealGuard() {
  const { currentSheet } = useUIStore()

  return useBlocker(({ currentLocation }) => {
    if (currentSheet !== 'none' && currentLocation.action === 'POP') {
      const isTrackingScreen = currentLocation.pathname.startsWith('/reports/')
      if (!isTrackingScreen) {
        return 'You have an unsent report. Please save or send it first.'
      }
    }
    return false
  })
}