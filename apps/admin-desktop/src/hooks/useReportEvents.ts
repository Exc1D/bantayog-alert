import { useEffect, useState } from 'react'
import { collection, onSnapshot, orderBy, query, limit, where } from 'firebase/firestore'
import { db } from '@/app/firebase'
import { reportEventSchema, type ReportEvent } from '@bantayog/shared-validators'

export interface ReportEventWithId extends ReportEvent {
  id: string
}

export interface ReportEventsResult {
  events: ReportEventWithId[]
  loading: boolean
  error: string | null
}

export function useReportEvents(municipalityId?: string): ReportEventsResult {
  const [events, setEvents] = useState<ReportEventWithId[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true)
    setError(null)

    const base = collection(db, 'report_events')
    const q = municipalityId
      ? query(
          base,
          where('municipalityId', '==', municipalityId),
          orderBy('createdAt', 'desc'),
          limit(50),
        )
      : query(base, orderBy('createdAt', 'desc'), limit(50))

    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        const parsedEvents = snap.docs
          .map((doc) => {
            const parsed = reportEventSchema.safeParse(doc.data())
            if (!parsed.success) return null
            return { id: doc.id, ...parsed.data }
          })
          .filter((e): e is ReportEventWithId => e !== null)

        setEvents(parsedEvents)
        setLoading(false)
      },
      (err) => {
        console.error('Error fetching report events:', err)
        setError(err instanceof Error ? err.message : 'Failed to fetch events')
        setLoading(false)
      },
    )

    return () => {
      unsubscribe()
    }
  }, [municipalityId])

  return { events, loading, error }
}
