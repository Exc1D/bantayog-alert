import { useEffect, useState } from 'react'
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore'
import { db } from '../app/firebase'

export interface IncidentMessage {
  id: string
  content: string
  senderRole: string
  senderDisplayName: string
  sentAt: number
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

    const q = query(collection(db, 'reports', reportId, 'messages'), orderBy('sentAt', 'asc'))

    return onSnapshot(
      q,
      (snap) => {
        setMessages(
          snap.docs.map((d) => {
            const data = d.data()
            const sentAt =
              data.sentAt && typeof data.sentAt === 'object' && 'toMillis' in data.sentAt
                ? (data.sentAt as { toMillis: () => number }).toMillis()
                : Date.now()
            const msg: IncidentMessage = {
              id: d.id,
              content: String(data.content ?? ''),
              senderRole: String(data.senderRole ?? ''),
              senderDisplayName: String(data.senderDisplayName ?? 'Admin'),
              sentAt,
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
