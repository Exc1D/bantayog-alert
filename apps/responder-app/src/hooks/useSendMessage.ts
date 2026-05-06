import { useState } from 'react'
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'
import { db, auth } from '../app/firebase'
import { awaitFreshAuthToken } from '../app/await-auth-token'

export function useSendMessage(reportId: string) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | undefined>(undefined)

  async function send(content: string): Promise<void> {
    if (!reportId.trim()) throw new Error('reportId_required')
    const trimmed = content.trim()
    if (!trimmed) throw new Error('content_required')

    setLoading(true)
    setError(undefined)
    try {
      const user = await awaitFreshAuthToken(auth)
      if (!user) throw new Error('auth_required')
      await addDoc(collection(db, 'reports', reportId, 'messages'), {
        body: trimmed,
        authorUid: user.uid,
        authorRole: 'responder',
        authorDisplayName: user.displayName ?? 'Responder',
        createdAt: serverTimestamp(),
        schemaVersion: 1,
      })
    } catch (err: unknown) {
      const normalized = err instanceof Error ? err : new Error(String(err))
      setError(normalized)
      throw normalized
    } finally {
      setLoading(false)
    }
  }

  return { send, loading, error }
}
