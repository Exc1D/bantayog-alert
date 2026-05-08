import { useState, useEffect } from 'react'

export type ConnectionStatus = 'live' | 'stale' | 'offline'

function getInitialStatus(): ConnectionStatus {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return 'offline'
  }
  return 'live'
}

export function useConnectionStatus() {
  const [status, setStatus] = useState<ConnectionStatus>(getInitialStatus)
  const [lastUpdated, setLastUpdated] = useState(new Date())

  useEffect(() => {
    const handleOnline = () => {
      setStatus('live')
      setLastUpdated(new Date())
    }

    const handleOffline = () => {
      setStatus('offline')
      setLastUpdated(new Date())
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // Stale detection: if no update in 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      if (status === 'live' && Date.now() - lastUpdated.getTime() > 30000) {
        setStatus('stale')
      }
    }, 5000)

    return () => {
      clearInterval(interval)
    }
  }, [status, lastUpdated])

  return { status, lastUpdated }
}
