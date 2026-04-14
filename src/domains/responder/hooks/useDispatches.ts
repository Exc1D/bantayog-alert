import { useEffect, useState, useCallback, useRef } from 'react'
import { onSnapshot, query, where, orderBy, collection, getDocs, getFirestore } from 'firebase/firestore'
import { getAuth } from 'firebase/auth'
import type { AssignedDispatch } from '../types'
import type { DispatchesError } from '../types'

interface UseDispatchesReturn {
  dispatches: AssignedDispatch[]
  isLoading: boolean
  error: DispatchesError | null
  refresh: () => Promise<void>
}

export function useDispatches(options?: { subscribe?: boolean }): UseDispatchesReturn {
  const [dispatches, setDispatches] = useState<AssignedDispatch[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<DispatchesError | null>(null)

  const abortControllerRef = useRef<AbortController | null>(null)
  const unsubscribeRef = useRef<(() => void) | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const retryCountRef = useRef(0)

  const MAX_RETRIES = 5
  const BASE_DELAY = 1000
  const MAX_DELAY = 30000

  const refresh = useCallback(async (): Promise<void> => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    abortControllerRef.current = new AbortController()
    const { signal } = abortControllerRef.current

    try {
      setError(null)
      const user = getAuth().currentUser

      if (!user || signal.aborted) {
        if (!signal.aborted) {
          setError({
            code: 'AUTH_EXPIRED',
            message: 'You must be logged in to view dispatches',
            isFatal: true
          })
        }
        return
      }

      const db = getFirestore()
      const q = query(
        collection(db, 'report_ops'),
        where('assignedTo', '==', user.uid),
        where('status', 'not-in', ['resolved', 'cancelled']),
        orderBy('assignedAt', 'desc')
      )

      const snapshot = await getDocs(q)

      if (signal.aborted) return

      const newDispatches: AssignedDispatch[] = []
      snapshot.forEach((doc) => {
        newDispatches.push({ id: doc.id, ...doc.data() } as AssignedDispatch)
      })

      setDispatches(newDispatches)
    } catch (err: unknown) {
      if (signal.aborted) return

      const errorCode = (err as { code?: string })?.code
      if (errorCode === 'permission-denied') {
        setError({
          code: 'PERMISSION_DENIED',
          message: 'You do not have permission to view dispatches',
          isFatal: true
        })
      } else if ((err as Error).name !== 'AbortError') {
        setError({
          code: 'NETWORK_ERROR',
          message: err instanceof Error ? err.message : 'Failed to load dispatches',
          isFatal: false
        })
      }
    } finally {
      if (abortControllerRef.current?.signal === signal) {
        abortControllerRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    let mounted = true

    const subscribe = async () => {
      try {
        const user = getAuth().currentUser

        if (!user || !mounted) return

        const db = getFirestore()
        const q = query(
          collection(db, 'report_ops'),
          where('assignedTo', '==', user.uid),
          where('status', 'not-in', ['resolved', 'cancelled']),
          orderBy('assignedAt', 'desc')
        )

        unsubscribeRef.current = onSnapshot(
          q,
          {
            next: (snapshot) => {
              if (!mounted) return

              const newDispatches: AssignedDispatch[] = []
              snapshot.forEach((doc) => {
                newDispatches.push({ id: doc.id, ...doc.data() } as AssignedDispatch)
              })

              setDispatches(newDispatches)
              setIsLoading(false)
              setError(null)
              retryCountRef.current = 0
            },

            error: (err) => {
              if (!mounted) return

              const errorCode = (err as { code?: string })?.code

              if (errorCode === 'permission-denied') {
                setError({
                  code: 'PERMISSION_DENIED',
                  message: 'You do not have permission to view dispatches',
                  isFatal: true
                })
                setIsLoading(false)
                return
              }

              if (retryCountRef.current < MAX_RETRIES) {
                const delay = Math.min(
                  BASE_DELAY * Math.pow(2, retryCountRef.current),
                  MAX_DELAY
                )

                reconnectTimeoutRef.current = setTimeout(() => {
                  if (mounted) {
                    retryCountRef.current++
                    subscribe()
                  }
                }, delay)
              } else {
                setError({
                  code: 'NETWORK_ERROR',
                  message: 'Unable to connect. Please check your connection and tap to retry.',
                  isFatal: false
                })
                setIsLoading(false)
              }
            }
          }
        )

      } catch (err: unknown) {
        if (!mounted) return

        setError({
          code: 'NETWORK_ERROR',
          message: err instanceof Error ? err.message : 'Failed to subscribe to dispatches',
          isFatal: false
        })
        setIsLoading(false)
      }
    }

    if (options?.subscribe !== false) {
      subscribe()
    } else {
      refresh().finally(() => setIsLoading(false))
    }

    return () => {
      mounted = false
      unsubscribeRef.current?.()
      reconnectTimeoutRef.current && clearTimeout(reconnectTimeoutRef.current)
      abortControllerRef.current?.abort()
    }
  }, [options?.subscribe, refresh])

  return { dispatches, isLoading, error, refresh }
}
