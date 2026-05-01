import { useState, useEffect } from 'react'
import { useOnlineStatus } from './useOnlineStatus.js'
import { draftStore } from '../services/draft-store'

const POLL_INTERVAL_MS = 2000

interface OfflineQueueStatus {
  isOnline: boolean
  queueCount: number
}

export function useOfflineQueueCount(): OfflineQueueStatus {
  const { navigatorOnline } = useOnlineStatus()
  const [count, setCount] = useState(0)

  useEffect(() => {
    let isMounted = true
    const update = async () => {
      try {
        const drafts = await draftStore.list()
        const pending = drafts.filter((d) => d.syncState !== 'synced')
        if (isMounted) setCount(pending.length)
      } catch (e) {
        console.error('Offline queue count failed:', e)
      }
    }

    void update()
    const interval = setInterval(() => {
      void update()
    }, POLL_INTERVAL_MS)

    return () => {
      isMounted = false
      clearInterval(interval)
    }
  }, [])

  return { isOnline: navigatorOnline, queueCount: count }
}
