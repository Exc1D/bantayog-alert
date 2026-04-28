import { useState } from 'react'
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

  async function initiateSession(codeA: string, codeB: string, reason: string): Promise<void> {
    setState((s) => ({ ...s, loading: true, error: null }))
    try {
      const { sessionId } = await callables.initiateBreakGlass({
        codeA,
        codeB,
        reason,
      })
      // Force token refresh so custom claims take effect immediately.
      // Without this, the client JWT still carries the pre-session claims
      // and any downstream permission check will fail.
      await auth.currentUser?.getIdToken(true)
      setState({
        active: true,
        sessionId,
        expiresAt: Date.now() + FOUR_HOURS_MS,
        error: null,
        loading: false,
      })
    } catch (err) {
      setState((s) => ({
        ...s,
        error: err instanceof Error ? err.message : 'Initiation failed',
        loading: false,
      }))
    }
  }

  async function deactivateSession(): Promise<void> {
    setState((s) => ({ ...s, loading: true, error: null }))
    try {
      await callables.deactivateBreakGlass()
      await auth.currentUser?.getIdToken(true)
      setState({
        active: false,
        sessionId: null,
        expiresAt: null,
        error: null,
        loading: false,
      })
    } catch (err) {
      setState((s) => ({
        ...s,
        error: err instanceof Error ? err.message : 'Deactivation failed',
        loading: false,
      }))
    }
  }

  return { ...state, initiateSession, deactivateSession }
}
