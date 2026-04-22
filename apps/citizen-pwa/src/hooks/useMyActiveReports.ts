import { useState, useEffect } from 'react'
import { getDoc, doc } from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { db, fns, hasFirebaseConfig } from '../services/firebase.js'
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
      try {
        const stored = await loadReports()
        if (!hasFirebaseConfig()) {
          const localOnly = stored.map((entry) => ({
            publicRef: entry.publicRef,
            reportType: entry.reportType,
            severity: entry.severity,
            lat: entry.lat,
            lng: entry.lng,
            submittedAt: entry.submittedAt,
            status: 'queued' as const,
            ...(entry.reportId ? { id: entry.reportId } : {}),
          }))
          if (!cancelled) {
            setReports(localOnly)
          }
          return
        }

        if (stored.length === 0) {
          if (!cancelled) setReports([])
          return
        }

        const lookup = httpsCallable<{ publicRef: string; secret: string }, LookupResult>(
          fns(),
          'requestLookup',
        )

        const resolved = await Promise.all(
          stored.map(async (entry) => {
            let reportId = entry.reportId

            if (!reportId) {
              try {
                const snap = await getDoc(doc(db(), 'report_lookup', entry.publicRef))
                if (snap.exists()) {
                  const data = snap.data() as { reportId?: string }
                  reportId = data.reportId
                  if (reportId) {
                    try {
                      await updateReportId(entry.publicRef, reportId)
                    } catch (err: unknown) {
                      console.error('Failed to cache reportId for active report', err)
                    }
                  }
                }
              } catch (err: unknown) {
                console.error('Failed to read report lookup doc for active report', err)
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
            } catch (err: unknown) {
              const code = (err as { code?: unknown }).code
              const normalizedCode =
                typeof code === 'string' ? code.replace(/_/g, '-').toLowerCase() : null
              if (normalizedCode !== 'not-found') {
                console.error('requestLookup failed for active report', err)
                throw err
              }
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
        }
      } catch (err: unknown) {
        console.error('Failed to load active reports', err)
        if (!cancelled) {
          setReports([])
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void fetchAll()
    return () => {
      cancelled = true
    }
  }, [])

  return { reports, loading }
}
