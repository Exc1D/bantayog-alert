import { useState } from 'react'

// Tracks which rows have a server call in flight, so their buttons can show
// a spinner and stay disabled. The id is cleared even when the call throws.
export function usePendingIds() {
  const [pendingIds, setPendingIds] = useState<Set<string>>(() => new Set())

  async function whilePending<T>(id: string, action: () => Promise<T>): Promise<T> {
    setPendingIds((prev) => new Set(prev).add(id))
    try {
      return await action()
    } finally {
      setPendingIds((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    }
  }

  return [pendingIds, whilePending] as const
}
