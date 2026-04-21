import { useEffect, useState } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '../app/firebase'
import type { Timestamp } from 'firebase/firestore'

export interface ReportDetail {
  reportId: string
  status: string
  municipalityLabel: string
  severityDerived: string
  createdAt: Timestamp
  verifiedBy?: string
  verifiedAt?: Timestamp
  currentDispatchId?: string
}
export interface ReportOps {
  verifyQueuePriority: number
  assignedMunicipalityAdmins: string[]
}

export function useReportDetail(reportId: string | undefined) {
  const [report, setReport] = useState<ReportDetail | null>(null)
  const [ops, setOps] = useState<ReportOps | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!reportId) {
      queueMicrotask(() => {
        setReport(null)
        setOps(null)
      })
      return
    }
    const u1 = onSnapshot(
      doc(db, 'reports', reportId),
      (s) => {
        setReport(
          s.exists()
            ? ({ reportId: s.id, ...(s.data() as Partial<ReportDetail>) } as ReportDetail)
            : null,
        )
      },
      (err) => {
        setError(`reports: ${err.message}`)
      },
    )
    const u2 = onSnapshot(
      doc(db, 'report_ops', reportId),
      (s) => {
        setOps(s.exists() ? (s.data() as ReportOps) : null)
      },
      (err) => {
        setError((prev) =>
          prev ? `${prev}; report_ops: ${err.message}` : `report_ops: ${err.message}`,
        )
      },
    )
    return () => {
      u1()
      u2()
    }
  }, [reportId])

  return { report, ops, error }
}
