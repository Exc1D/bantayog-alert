import { useEffect } from 'react'
import { useWindowSyncContext } from '../providers/WindowSyncProvider'
import type { SyncMessage } from '../stores/commandCenterStore'

export function useWindowSync(onMessage?: (msg: SyncMessage) => void) {
  const { sendSync, subscribe } = useWindowSyncContext()

  useEffect(() => {
    if (!onMessage) return
    return subscribe(onMessage)
  }, [onMessage, subscribe])

  return { sendSync }
}
