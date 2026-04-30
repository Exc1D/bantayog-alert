import { useState, useEffect } from 'react'
import { draftStore } from '../services/draft-store'

const POLL_INTERVAL_MS = 5000

export function useOfflineQueueCount(): number {
  const [count, setCount] = useState(0)

  useEffect(() => {
    let isMounted = true
    const update = async () => {
      try {
        const drafts = await draftStore.list()
        const pending = drafts.filter(
          (d) => d.syncState === 'local_only' || d.syncState === 'syncing',
        )
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

  return count
}
