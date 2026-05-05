import { useBlocker } from 'react-router-dom'
import { useUIStore } from './store'

export function useRevealGuard() {
  const { currentSheet } = useUIStore()

  return useBlocker(({ historyAction }) => {
    if (currentSheet !== 'none' && historyAction === 'POP') {
      return true
    }
    return false
  })
}