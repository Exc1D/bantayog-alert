import { useEffect, useRef, useState, useCallback } from 'react'

let announceFn: ((msg: string) => void) | null = null

const MIN_INTERVAL_MS = 3000

export function announce(message: string) {
  announceFn?.(message)
}

export function LiveAnnouncer() {
  const [announcement, setAnnouncement] = useState('')
  const queueRef = useRef<string[]>([])
  const lastAnnounceRef = useRef(0)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const flush = useCallback(() => {
    if (queueRef.current.length === 0) return
    const combined = queueRef.current.join('. ')
    queueRef.current = []
    setAnnouncement(combined)
    lastAnnounceRef.current = Date.now()
  }, [])

  const scheduleFlush = useCallback(() => {
    if (timeoutRef.current) return
    const elapsed = Date.now() - lastAnnounceRef.current
    const delay = Math.max(0, MIN_INTERVAL_MS - elapsed)
    timeoutRef.current = setTimeout(() => {
      flush()
      timeoutRef.current = null
    }, delay)
  }, [flush])

  useEffect(() => {
    announceFn = (msg: string) => {
      queueRef.current.push(msg)
      scheduleFlush()
    }
    return () => {
      announceFn = null
    }
  }, [scheduleFlush])

  return (
    <div aria-live="polite" aria-atomic="true" className="sr-only" role="status">
      {announcement}
    </div>
  )
}
