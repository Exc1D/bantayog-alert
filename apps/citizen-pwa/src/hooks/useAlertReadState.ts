import { useState, useCallback, useEffect } from 'react'

const STORAGE_KEY = 'bantayog_alert_reads'

type ReadAlerts = Record<string, true>

export function useAlertReadState() {
  const [readAlerts, setReadAlerts] = useState<ReadAlerts>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      return stored ? (JSON.parse(stored) as ReadAlerts) : {}
    } catch {
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
