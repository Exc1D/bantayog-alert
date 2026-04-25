import { useQuery } from '@tanstack/react-query'
import {
  collection,
  query,
  where,
  getCountFromServer,
  getDocs,
  orderBy,
  limit,
} from 'firebase/firestore'
import { db } from '../app/firebase'
import { useAuth } from '@bantayog/shared-ui'

const ACTIVE_STATUSES = [
  'new',
  'awaiting_verify',
  'verified',
  'assigned',
  'acknowledged',
  'en_route',
  'on_scene',
]

export function AnalyticsDashboardPage() {
  const { claims } = useAuth()
  const municipalityId =
    typeof claims?.municipalityId === 'string' ? claims.municipalityId : undefined

  const { data: activeCount, isLoading } = useQuery({
    queryKey: ['analytics', 'activeCount', municipalityId],
    queryFn: async () => {
      const q = query(
        collection(db, 'report_ops'),
        ...(municipalityId ? [where('municipalityId', '==', municipalityId)] : []),
        where('status', 'in', ACTIVE_STATUSES),
      )
      const snap = await getCountFromServer(q)
      return snap.data().count
    },
    refetchInterval: 30_000,
  })

  const { data: snapshots } = useQuery({
    queryKey: ['analytics', 'snapshots', municipalityId],
    queryFn: async () => {
      const q = query(collection(db, `analytics_snapshots`), orderBy('__name__', 'desc'), limit(7))
      const snap = await getDocs(q)
      return snap.docs.map((d) => ({ date: d.id, ...d.data() }))
    },
    refetchInterval: 60_000,
  })

  if (isLoading) return <p>Loading analytics…</p>

  return (
    <main>
      <h1>Analytics · {municipalityId ?? 'Province'}</h1>
      <section>
        <h2>Live Active Incidents</h2>
        <p style={{ fontSize: 48, fontWeight: 'bold' }}>{activeCount ?? '—'}</p>
      </section>
      <section>
        <h2>7-Day Trend</h2>
        {snapshots && snapshots.length > 0 ? (
          <svg width="400" height="80" aria-label="7-day trend chart">
            {snapshots.map(
              (s: { date: string; reportsByStatus?: Record<string, number> }, i: number) => {
                const statusMap = s.reportsByStatus ?? {}
                const total = Object.values(statusMap).reduce<number>((acc, v) => acc + v, 0)
                const barH = Math.min(total, 70)
                return (
                  <rect
                    key={i}
                    x={i * 56}
                    y={70 - barH}
                    width={40}
                    height={barH}
                    fill="#3b82f6"
                    aria-label={`${s.date}: ${String(total)} reports`}
                  />
                )
              },
            )}
          </svg>
        ) : (
          <p>No snapshot data yet.</p>
        )}
      </section>
    </main>
  )
}
