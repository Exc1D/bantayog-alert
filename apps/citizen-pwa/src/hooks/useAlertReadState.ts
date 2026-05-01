import { useState, useCallback, useEffect } from 'react'

const STORAGE_KEY = 'bantayog_alert_reads'

type ReadAlerts = Record<string, true>

function isValidReadAlerts(value: unknown): value is ReadAlerts {
  if (typeof value !== 'object' || value === null) return false
  return Object.entries(value).every(([key, val]) => typeof key === 'string' && val === true)
}

export function useAlertReadState() {
  const [readAlerts, setReadAlerts] = useState<ReadAlerts>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (!stored) return {}
      const parsed = JSON.parse(stored) as unknown
      if (!isValidReadAlerts(parsed)) {
        console.error('Invalid alert read state in localStorage, resetting')
        return {}
      }
      return parsed
    } catch (error) {
      console.error('Failed to parse alert read state from localStorage:', error)
      return {}
    }
  })

  // Persist to localStorage whenever state changes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(readAlerts))
    } catch (error) {
      console.error('Failed to persist alert read state:', error)
    }
  }, [readAlerts])

  const markAsRead = useCallback((alertId: string) => {
    setReadAlerts((prev) => ({ ...prev, [alertId]: true }))
  }, [])

  const isUnread = useCallback((alertId: string) => !readAlerts[alertId], [readAlerts])

  const unreadCount = useCallback(
    (alertIds: string[]) => alertIds.filter((id) => !readAlerts[id]).length,
    [readAlerts],
  )

  return { readAlerts, markAsRead, isUnread, unreadCount }
}
