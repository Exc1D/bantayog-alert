import { useState, useEffect } from 'react'
import { WifiOff, AlertTriangle } from 'lucide-react'

interface Props {
  error?: string | null
  onRetry?: () => void
}

export function OfflineBanner({ error, onRetry }: Props) {
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
        className="flex items-center justify-center gap-3 bg-[var(--color-danger)] px-4 py-2 text-sm text-white"
        role="alert"
      >
        <AlertTriangle className="h-4 w-4" />
        <span>{error}</span>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="rounded border border-white/30 px-2 py-0.5 text-xs hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
          >
            Retry
          </button>
        )}
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
