import { useState, useEffect } from 'react'
import { getDoc, doc } from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { db, fns } from '../services/firebase.js'
import { loadReports, updateReportId } from '../services/localForageReports.js'
import type { MyReport } from '../components/MapTab/types.js'

interface LookupResult {
  status: string
  lastStatusAt: number
  municipalityLabel: string
}

export function useMyActiveReports(): {
  reports: MyReport[]
  loading: boolean
} {
  const [reports, setReports] = useState<MyReport[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function fetchAll(): Promise<void> {
      const stored = await loadReports()
      if (stored.length === 0) {
        if (!cancelled) setLoading(false)
        return
      }

      const lookup = httpsCallable<{ publicRef: string; secret: string }, LookupResult>(
        fns(),
        'requestLookup',
      )

      const resolved = await Promise.all(
        stored.map(async (entry) => {
          let reportId = entry.reportId

          // Read report_lookup to get reportId if not yet cached
          if (!reportId) {
            const snap = await getDoc(doc(db(), 'report_lookup', entry.publicRef))
            if (snap.exists()) {
              const data = snap.data() as { reportId?: string }
              reportId = data.reportId
              if (reportId) await updateReportId(entry.publicRef, reportId)
            }
          }

          try {
            const res = await lookup({ publicRef: entry.publicRef, secret: entry.secret })
            const info = res.data
            return {
              publicRef: entry.publicRef,
              reportType: entry.reportType,
              severity: entry.severity,
              lat: entry.lat,
              lng: entry.lng,
              submittedAt: entry.submittedAt,
              status: info.status as MyReport['status'],
              municipalityLabel: info.municipalityLabel,
              lastStatusAt: info.lastStatusAt,
              ...(reportId ? { id: reportId } : {}),
            } satisfies MyReport
          } catch {
            return {
              publicRef: entry.publicRef,
              reportType: entry.reportType,
              severity: entry.severity,
              lat: entry.lat,
              lng: entry.lng,
              submittedAt: entry.submittedAt,
              status: 'queued',
              ...(reportId ? { id: reportId } : {}),
            } satisfies MyReport
          }
        }),
      )

      if (!cancelled) {
        setReports(resolved)
        setLoading(false)
      }
    }

    void fetchAll()
    return () => {
      cancelled = true
    }
  }, [])

  return { reports, loading }
}
