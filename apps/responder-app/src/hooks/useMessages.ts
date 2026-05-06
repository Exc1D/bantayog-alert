import { useEffect, useState } from 'react'
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore'
import { db } from '../app/firebase'

export interface IncidentMessage {
  id: string
  body: string
  authorUid: string
  authorRole: string
  authorDisplayName: string
  createdAt: number
  photoUrl?: string
}

export function useMessages(reportId: string | undefined) {
  const [messages, setMessages] = useState<IncidentMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!reportId) {
      queueMicrotask(() => {
        setMessages([])
        setLoading(false)
      })
      return
    }

    const q = query(collection(db, 'reports', reportId, 'messages'), orderBy('createdAt', 'asc'))

    return onSnapshot(
      q,
      (snap) => {
        setMessages(
          snap.docs.map((d) => {
            const data = d.data()
            const tsRaw = data.createdAt ?? data.sentAt
            const createdAt =
              tsRaw && typeof tsRaw === 'object' && 'toMillis' in tsRaw
                ? (tsRaw as { toMillis: () => number }).toMillis()
                : Date.now()
            const msg: IncidentMessage = {
              id: d.id,
              body: String(data.body ?? data.content ?? ''),
              authorUid: String(data.authorUid ?? data.senderUid ?? ''),
              authorRole: String(data.authorRole ?? data.senderRole ?? ''),
              authorDisplayName: String(
                data.authorDisplayName ?? data.senderDisplayName ?? 'Admin',
              ),
              createdAt,
            }
            if (data.photoUrl != null) msg.photoUrl = String(data.photoUrl)
            return msg
          }),
        )
        setLoading(false)
        setError(null)
      },
      (err) => {
        console.error('[useMessages] listener error:', err)
        setError(err.message)
        setLoading(false)
      },
    )
  }, [reportId])

  return { messages, loading, error }
}
