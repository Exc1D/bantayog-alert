import { useState, useCallback, useRef, useEffect } from 'react'
import { getAuth } from 'firebase/auth'
import { callables } from '../services/callables'

interface BreakGlassState {
  active: boolean
  sessionId: string | null
  expiresAt: number | null
  error: string | null
  loading: boolean
}

const FOUR_HOURS_MS = 4 * 60 * 60 * 1000

export function useBreakGlass() {
  const auth = getAuth()
  const [state, setState] = useState<BreakGlassState>({
    active: false,
    sessionId: null,
    expiresAt: null,
    error: null,
    loading: false,
  })

  // Guard against state updates on an unmounted component
  const unmountedRef = useRef(false)
  useEffect(() => {
    unmountedRef.current = false
    return () => {
      unmountedRef.current = true
    }
  }, [])

  const initiateSession = useCallback(
    async (codeA: string, codeB: string, reason: string): Promise<void> => {
      const normalizedCodeA = codeA.trim()
      const normalizedCodeB = codeB.trim()
      const normalizedReason = reason.trim()
      if (!normalizedCodeA || !normalizedCodeB || !normalizedReason) {
        if (!unmountedRef.current) {
          setState((s) => ({
            ...s,
            error: 'Code A, Code B, and reason are required',
            loading: false,
          }))
        }
        return
      }
      if (!unmountedRef.current) {
        setState((s) => ({ ...s, loading: true, error: null }))
      }
      try {
        const { sessionId } = await callables.initiateBreakGlass({
          codeA: normalizedCodeA,
          codeB: normalizedCodeB,
          reason: normalizedReason,
        })
        // Force token refresh so custom claims take effect immediately.
        // Without this, the client JWT still carries the pre-session claims
        // and any downstream permission check will fail.
        await auth.currentUser?.getIdToken(true)
        if (!unmountedRef.current) {
          setState({
            active: true,
            sessionId,
            expiresAt: Date.now() + FOUR_HOURS_MS,
            error: null,
            loading: false,
          })
        }
      } catch (err: unknown) {
        if (!unmountedRef.current) {
          setState({
            active: false,
            sessionId: null,
            expiresAt: null,
            error: err instanceof Error ? err.message : 'Initiation failed',
            loading: false,
          })
        }
      }
    },
    [auth],
  )

  const deactivateSession = useCallback(async (): Promise<void> => {
    if (!unmountedRef.current) {
      setState((s) => ({ ...s, loading: true, error: null }))
    }
    try {
      await callables.deactivateBreakGlass()
      await auth.currentUser?.getIdToken(true)
      if (!unmountedRef.current) {
        setState({
          active: false,
          sessionId: null,
          expiresAt: null,
          error: null,
          loading: false,
        })
      }
    } catch (err: unknown) {
      if (!unmountedRef.current) {
        setState((s) => ({
          ...s,
          error: err instanceof Error ? err.message : 'Deactivation failed',
          loading: false,
        }))
      }
    }
  }, [auth])

  return { ...state, initiateSession, deactivateSession }
}
