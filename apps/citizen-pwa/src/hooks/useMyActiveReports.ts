import { useState, useEffect, useCallback } from 'react'
import { onSnapshot, doc } from 'firebase/firestore'
import type { FirestoreError } from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { db, fns, hasFirebaseConfig } from '../services/firebase.js'
import { loadReports, updateReportId } from '../services/localForageReports.js'
import type { StoredReport } from '../services/localForageReports.js'
import type { MyReport } from '../components/MapTab/types.js'

interface LookupResult {
  status: string
  lastStatusAt: number
  municipalityLabel: string
}

interface ReportSnapshotData {
  status?: string
  municipalityLabel?: string
  updatedAt?: number
  submittedAt?: number
  lastStatusAt?: number
}

type MyActiveReportsStatus = 'loading' | 'ready' | 'error'

const REPORT_LOAD_ERROR = "We can't load your reports right now"

function baseFromStored(entry: StoredReport): MyReport {
  return {
    publicRef: entry.publicRef,
    reportType: entry.reportType,
    severity: entry.severity,
    lat: entry.lat,
    lng: entry.lng,
    submittedAt: entry.submittedAt,
    status: 'queued',
    ...(entry.municipalityLabel ? { municipalityLabel: entry.municipalityLabel } : {}),
    ...(entry.reportId ? { id: entry.reportId } : {}),
  }
}

export function useMyActiveReports(): {
  reports: MyReport[]
  loading: boolean
  status: MyActiveReportsStatus
  error: string | null
  retry: () => void
} {
  const [stored, setStored] = useState<StoredReport[]>([])
  const [storedLoaded, setStoredLoaded] = useState(false)
  const [reports, setReports] = useState<MyReport[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [retryNonce, setRetryNonce] = useState(0)

  const retry = useCallback(() => {
    setError(null)
    setLoading(true)
    setStoredLoaded(false)
    setRetryNonce((nonce) => nonce + 1)
  }, [])

  useEffect(() => {
    let cancelled = false

    function refreshStored(): void {
      loadReports()
        .then((entries) => {
          if (cancelled) return
          setStored(entries)
          setStoredLoaded(true)
        })
        .catch((err: unknown) => {
          console.error('[useMyActiveReports] loadReports failed', err)
          if (cancelled) return
          setStored([])
          setStoredLoaded(true)
        })
    }

    refreshStored()
    window.addEventListener('bantayog:report-saved', refreshStored)
    return () => {
      cancelled = true
      window.removeEventListener('bantayog:report-saved', refreshStored)
    }
  }, [retryNonce])

  // Subscribe per stored entry; keyed by sorted publicRefs so we don't tear
  // down listeners on identity-only changes to the stored array.
  const subscriptionKey = stored
    .map((s) => s.publicRef)
    .slice()
    .sort()
    .join(',')

  useEffect(() => {
    if (!storedLoaded) return

    // Derived state from the stored list — must be set synchronously so the
    // map/profile/pill render the seeded queued state on the same frame the
    // stored list resolves; deferring to a microtask flickers an empty UI.
    if (stored.length === 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setReports([])

      setError(null)
      setLoading(false)
      return
    }

    const liveMap = new Map<string, MyReport>(stored.map((s) => [s.publicRef, baseFromStored(s)]))
    const failedRefs = new Set<string>()

    setReports([...liveMap.values()])

    if (!hasFirebaseConfig()) {
      setError(null)
      setLoading(false)
      return
    }

    let cancelled = false
    const flushReports = (): void => {
      if (cancelled) return
      setReports([...liveMap.values()])
    }

    const unsubs: (() => void)[] = []
    let pendingFirstResolutions = stored.length
    let loadingFlipped = false
    function markEntryResolved(): void {
      if (cancelled || loadingFlipped) return
      pendingFirstResolutions -= 1
      if (pendingFirstResolutions <= 0) {
        loadingFlipped = true
        setLoading(false)
      }
    }

    function markEntryHealthy(publicRef: string): void {
      if (cancelled) return
      failedRefs.delete(publicRef)
      setError(failedRefs.size > 0 ? REPORT_LOAD_ERROR : null)
    }

    function markEntryFailed(publicRef: string): void {
      if (cancelled) return
      failedRefs.add(publicRef)
      setError(REPORT_LOAD_ERROR)
    }

    const callable = httpsCallable<{ publicRef: string; secret: string }, LookupResult>(
      fns(),
      'requestLookup',
    )

    async function fallbackToCallable(entry: StoredReport, reportId?: string): Promise<void> {
      try {
        const res = await callable({ publicRef: entry.publicRef, secret: entry.secret })
        if (cancelled) return
        const info = res.data
        const merged = baseFromStored(entry)
        merged.status = info.status as MyReport['status']
        merged.municipalityLabel = info.municipalityLabel
        merged.lastStatusAt = info.lastStatusAt
        if (reportId) merged.id = reportId
        liveMap.set(entry.publicRef, merged)
        flushReports()
        markEntryHealthy(entry.publicRef)
      } catch (err: unknown) {
        if (cancelled) return
        const code = (err as { code?: unknown }).code
        const normalizedCode =
          typeof code === 'string' ? code.replace(/_/g, '-').toLowerCase() : null
        if (normalizedCode !== 'not-found') {
          console.error('[useMyActiveReports] callable fallback failed', err)
        }
        markEntryFailed(entry.publicRef)
      }
    }

    for (const entry of stored) {
      let reportUnsub: (() => void) | null = null
      let firstEmitted = false

      const lookupUnsub = onSnapshot(
        doc(db(), 'report_lookup', entry.publicRef),
        (snap) => {
          if (!snap.exists()) {
            // Backend hasn't materialised yet; keep status='queued'.
            if (!firstEmitted) {
              firstEmitted = true
              markEntryResolved()
            }
            return
          }
          const lookupData = snap.data() as { reportId?: string }
          const reportId = lookupData.reportId
          if (!reportId) return

          if (!entry.reportId) {
            updateReportId(entry.publicRef, reportId).catch((err: unknown) => {
              console.error('[useMyActiveReports] cache reportId failed', err)
            })
          }

          // Reflect the resolved id even before reports/{id} subscription emits.
          const cur = liveMap.get(entry.publicRef) ?? baseFromStored(entry)
          if (cur.id !== reportId) {
            cur.id = reportId
            liveMap.set(entry.publicRef, cur)
            flushReports()
          }

          if (reportUnsub || cancelled) return

          reportUnsub = onSnapshot(
            doc(db(), 'reports', reportId),
            (rsnap) => {
              const merged = baseFromStored(entry)
              merged.id = reportId
              if (rsnap.exists()) {
                const r = rsnap.data() as ReportSnapshotData
                if (typeof r.status === 'string') merged.status = r.status as MyReport['status']
                if (typeof r.municipalityLabel === 'string') {
                  merged.municipalityLabel = r.municipalityLabel
                }
                merged.lastStatusAt =
                  r.lastStatusAt ?? r.updatedAt ?? r.submittedAt ?? entry.submittedAt
              }
              liveMap.set(entry.publicRef, merged)
              flushReports()
              markEntryHealthy(entry.publicRef)
              if (!firstEmitted) {
                firstEmitted = true
                markEntryResolved()
              }
            },
            (err: FirestoreError) => {
              if (err.code === 'permission-denied') {
                void fallbackToCallable(entry, reportId)
              } else {
                console.error('[useMyActiveReports] reports snapshot error', err)
              }
              if (!firstEmitted) {
                firstEmitted = true
                markEntryResolved()
              }
            },
          )
          unsubs.push(reportUnsub)
        },
        (err: FirestoreError) => {
          console.error('[useMyActiveReports] lookup snapshot error', err)
          // Lookup is publicly readable; an error here is unexpected. Try the
          // callable so we still surface a status to the user.
          void fallbackToCallable(entry)
          if (!firstEmitted) {
            firstEmitted = true
            markEntryResolved()
          }
        },
      )
      unsubs.push(lookupUnsub)
    }

    return () => {
      cancelled = true
      for (const u of unsubs) u()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storedLoaded, subscriptionKey, retryNonce])

  const status: MyActiveReportsStatus = error ? 'error' : loading ? 'loading' : 'ready'

  return { reports, loading, status, error, retry }
}
