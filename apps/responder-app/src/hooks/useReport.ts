import { useEffect, useState } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '../app/firebase'
import { toMillis } from '../lib/to-millis'

export interface ReportSummary {
  reportType: string
  severity: 'low' | 'medium' | 'high'
  status: string
  description: string
  municipalityId: string
  municipalityLabel?: string
  barangayId?: string
  publicLocation?: { latitude: number; longitude: number }
  source: string
  submittedAt: number
  verifiedAt?: number
  contactPhone?: string
}

function parseSeverity(value: unknown): 'low' | 'medium' | 'high' {
  if (value === 'low' || value === 'medium' || value === 'high') return value
  return 'low'
}

export function useReport(reportId: string | undefined) {
  const [report, setReport] = useState<ReportSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!reportId) {
      queueMicrotask(() => {
        setReport(null)
        setLoading(false)
        setError(null)
      })
      return
    }

    const ref = doc(db, 'reports', reportId)
    return onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists()) {
          setReport(null)
          setLoading(false)
          setError(null)
          return
        }
        const d = snap.data()
        const submittedAt = toMillis(d.submittedAt) ?? Date.now()
        const verifiedAt = toMillis(d.verifiedAt)
        const loc = d.publicLocation as { latitude?: number; longitude?: number } | undefined

        const summary: ReportSummary = {
          reportType: String(d.reportType ?? 'other'),
          severity: parseSeverity(d.severity),
          status: String(d.status ?? 'new'),
          description: String(d.description ?? ''),
          municipalityId: String(d.municipalityId ?? ''),
          source: String(d.source ?? 'web'),
          submittedAt,
        }
        if (d.municipalityLabel != null) {
          summary.municipalityLabel = String(d.municipalityLabel)
        }
        if (d.barangayId != null) {
          summary.barangayId = String(d.barangayId)
        }
        if (loc?.latitude != null && loc.longitude != null) {
          summary.publicLocation = { latitude: loc.latitude, longitude: loc.longitude }
        }
        if (verifiedAt != null) {
          summary.verifiedAt = verifiedAt
        }

        const contactPhone =
          (d.contact as { phone?: string } | undefined)?.phone ??
          (d.phone as string | undefined) ??
          (d.adminPhone as string | undefined)
        if (contactPhone != null) {
          summary.contactPhone = contactPhone
        }

        setReport(summary)
        setLoading(false)
        setError(null)
      },
      (err) => {
        console.error('[useReport] listener error:', err)
        setError(err.message)
        setLoading(false)
      },
    )
  }, [reportId])

  return { report, loading, error }
}
