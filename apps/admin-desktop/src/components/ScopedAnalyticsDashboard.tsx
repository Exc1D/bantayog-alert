import { useQuery } from '@tanstack/react-query'
import {
  collection,
  query,
  where,
  getCountFromServer,
  getDocs,
  getDoc,
  doc,
  orderBy,
  limit,
} from 'firebase/firestore'
import { ACTIVE_REPORT_STATUSES } from '@bantayog/shared-types'
import { db } from '../app/firebase'

interface ScopedAnalyticsDashboardProps {
  scopeField?: 'municipalityId' | 'agencyId'
  scopeId: string
  scopeLabel: string
}

export function ScopedAnalyticsDashboard({
  scopeField,
  scopeId,
  scopeLabel,
}: ScopedAnalyticsDashboardProps) {
  const { data: activeCount, isLoading } = useQuery({
    queryKey: ['analytics', 'activeCount', scopeField ?? 'province', scopeId],
    queryFn: async () => {
      const q = query(
        collection(db, 'report_ops'),
        ...(scopeField ? [where(scopeField, '==', scopeId)] : []),
        where('status', 'in', ACTIVE_REPORT_STATUSES),
      )
      const snap = await getCountFromServer(q)
      return snap.data().count
    },
    refetchInterval: 30_000,
  })

  const { data: snapshots, isLoading: isSnapshotsLoading } = useQuery({
    queryKey: ['analytics', 'snapshots', scopeId],
    queryFn: async () => {
      const q = query(collection(db, 'analytics_snapshots'), orderBy('__name__', 'desc'), limit(7))
      const dateDocs = await getDocs(q)
      const rows = await Promise.all(
        dateDocs.docs.map(async (d) => {
          const summaryRef = doc(db, 'analytics_snapshots', d.id, scopeId, 'summary')
          const summarySnap = await getDoc(summaryRef)
          return summarySnap.exists() ? { date: d.id, ...summarySnap.data() } : null
        }),
      )
      return rows.filter(
        (r): r is { date: string; reportsByStatus?: Record<string, number> } => r !== null,
      )
    },
    refetchInterval: 60_000,
  })

  const maxSnapshotTotal =
    snapshots && snapshots.length > 0
      ? Math.max(
          1,
          ...snapshots.map((s) =>
            Object.values(s.reportsByStatus ?? {}).reduce<number>((a, v) => a + v, 0),
          ),
        )
      : 1

  if (isLoading) return <p>Loading analytics…</p>

  return (
    <main>
      <h1>Analytics · {scopeLabel}</h1>
      <section>
        <h2>Live Active Incidents</h2>
        <p style={{ fontSize: 48, fontWeight: 'bold' }}>{activeCount ?? '—'}</p>
      </section>
      <section>
        <h2>7-Day Trend</h2>
        {isSnapshotsLoading ? (
          <p>Loading trend…</p>
        ) : snapshots && snapshots.length > 0 ? (
          <svg width="400" height="80" aria-label="7-day trend chart">
            {snapshots.map(
              (s: { date: string; reportsByStatus?: Record<string, number> }, i: number) => {
                const statusMap = s.reportsByStatus ?? {}
                const total = Object.values(statusMap).reduce<number>((acc, v) => acc + v, 0)
                const barH = Math.round((total / maxSnapshotTotal) * 70)
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
