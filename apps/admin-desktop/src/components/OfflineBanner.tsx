import { useState, useEffect } from 'react'
import { WifiOff, AlertTriangle } from 'lucide-react'

interface Props {
  error?: string | null
}

export function OfflineBanner({ error }: Props) {
  const [isOffline, setIsOffline] = useState(!navigator.onLine)

  useEffect(() => {
    const onOnline = () => {
      setIsOffline(false)
    }
    const onOffline = () => {
      setIsOffline(true)
    }
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [])

  if (error) {
    return (
      <div
        className="flex items-center justify-center gap-2 bg-[var(--color-danger)] px-4 py-2 text-sm text-white"
        role="alert"
      >
        <AlertTriangle className="h-4 w-4" />
        {error}
      </div>
    )
  }

  if (!isOffline) return null

  return (
    <div
      className="flex items-center justify-center gap-2 bg-[var(--color-warn)] px-4 py-2 text-sm text-white"
      role="alert"
    >
      <WifiOff className="h-4 w-4" />
      Working offline · changes will not sync. Reconnect to resume operations.
    </div>
  )
}
