import { useEffect, useRef, useState } from 'react'
import { httpsCallable } from 'firebase/functions'
import { auth, functions } from '../app/firebase'
import { awaitFreshAuthToken } from '../app/await-auth-token'

interface RequestBackupRequest {
  dispatchId: string
  reason: string
  idempotencyKey: string
}

export function useRequestBackup(dispatchId: string) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | undefined>()
  const keyRef = useRef(crypto.randomUUID())

  useEffect(() => {
    keyRef.current = crypto.randomUUID()
  }, [dispatchId])

  async function request(reason: string) {
    const trimmedReason = reason.trim()
    if (!trimmedReason) {
      const err = new Error('reason_required')
      setError(err)
      throw err
    }
    if (!dispatchId) {
      const err = new Error('dispatch_id_required')
      setError(err)
      throw err
    }
    setLoading(true)
    setError(undefined)
    try {
      const user = await awaitFreshAuthToken(auth)
      if (!user) throw new Error('auth_required')
      const fn = httpsCallable<
        RequestBackupRequest,
        { status: 'requested'; backupRequestId: string }
      >(functions, 'requestBackup')
      await fn({ dispatchId, reason: trimmedReason, idempotencyKey: keyRef.current })
    } catch (err: unknown) {
      const normalized = err instanceof Error ? err : new Error(String(err))
      setError(normalized)
      throw normalized
    } finally {
      setLoading(false)
    }
  }

  return { request, loading, error }
}
