import { useState, useEffect } from 'react'
import { draftStore } from '../services/draft-store'

const POLL_INTERVAL_MS = 5000

export function useOfflineQueueCount(): number {
  const [count, setCount] = useState(0)

  useEffect(() => {
    const update = async () => {
      const drafts = await draftStore.list()
      const pending = drafts.filter(
        (d) => d.syncState === 'local_only' || d.syncState === 'syncing',
      )
      setCount(pending.length)
    }

    void update()
    const interval = setInterval(() => {
      void update()
    }, POLL_INTERVAL_MS)

    return () => {
      clearInterval(interval)
    }
  }, [])

  return count
}
