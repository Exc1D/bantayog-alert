import { useEffect, useRef } from 'react'
import { useWindowSyncContext } from '../providers/WindowSyncProvider'
import type { SyncMessage } from '../stores/commandCenterStore'

export function useWindowSync(onMessage?: (msg: SyncMessage) => void) {
  const { sendSync, subscribe } = useWindowSyncContext()
  const handlerRef = useRef(onMessage)

  // Keep ref pointing at the latest handler without re-running the subscribe effect.
  useEffect(() => {
    handlerRef.current = onMessage
  }, [onMessage])

  useEffect(() => {
    const unsubscribe = subscribe((msg) => {
      handlerRef.current?.(msg)
    })
    return unsubscribe
  }, [subscribe])

  return { sendSync }
}
