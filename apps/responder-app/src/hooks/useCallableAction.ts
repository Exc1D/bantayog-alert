import { useRef, useState } from 'react'
import type { User } from 'firebase/auth'
import { auth } from '../app/firebase'
import { awaitFreshAuthToken } from '../app/await-auth-token'

interface ActionContext {
  user: User
  idempotencyKey: string
}

// Shared loading/error/auth/idempotency plumbing for responder write actions.
// The key is stable across retries of the same action and rotates when
// keyScope (usually the dispatchId) changes.
export function useCallableAction(tag: string, keyScope: string) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | undefined>()
  const keyRef = useRef(crypto.randomUUID())
  const scopeRef = useRef(keyScope)

  async function run<T>(action: (ctx: ActionContext) => Promise<T>): Promise<T> {
    // Rotate synchronously on scope change so the first action on a new
    // dispatch can never reuse the previous dispatch's key.
    if (scopeRef.current !== keyScope) {
      scopeRef.current = keyScope
      keyRef.current = crypto.randomUUID()
    }
    setLoading(true)
    setError(undefined)
    try {
      const user = await awaitFreshAuthToken(auth)
      if (!user) throw new Error('auth_required')
      return await action({ user, idempotencyKey: keyRef.current })
    } catch (err: unknown) {
      const normalized = err instanceof Error ? err : new Error(String(err))
      console.error(`[${tag}]`, normalized)
      setError(normalized)
      throw normalized
    } finally {
      setLoading(false)
    }
  }

  // Client-side validation failure: surface it like a server error, without a round trip.
  function fail(code: string): never {
    const err = new Error(code)
    setError(err)
    throw err
  }

  return { run, fail, loading, error, keyRef }
}
