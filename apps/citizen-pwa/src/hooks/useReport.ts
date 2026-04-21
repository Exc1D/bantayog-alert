import { useEffect, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { doc, onSnapshot } from 'firebase/firestore'
import type { DocumentSnapshot } from 'firebase/firestore'
import { db } from '../services/firebase'
import { mapReportFromFirestore } from '../lib/mappers'
import type { ReportStatus } from '@bantayog/shared-types'

export interface ReportTimelineEvent {
  event: string
  timestamp: number
  actor: string
  note?: string
}

export interface ReportLocation {
  address?: string
  lat?: number
  lng?: number
}

export interface ReportData {
  id: string
  status: ReportStatus
  timeline: ReportTimelineEvent[]
  type?: string
  reportType?: string
  severity?: string
  createdAt?: number
  updatedAt?: number
  location?: ReportLocation
  reporterName?: string
  reporterPhone?: string
  resolutionNote?: string
  closedBy?: string
}

export function useReport(reportRef: string) {
  const queryClient = useQueryClient()
  const unmountedRef = useRef(false)

  useEffect(() => {
    unmountedRef.current = false

    const unsubscribe = onSnapshot(
      doc(db(), `reports/${reportRef}`),
      (snapshot: DocumentSnapshot) => {
        if (unmountedRef.current) return
        if (snapshot.exists()) {
          const data = snapshot.data()
          queryClient.setQueryData(['reports', reportRef], mapReportFromFirestore(data))
        } else {
          queryClient.setQueryData(['reports', reportRef], null)
        }
      },
      (error: { message: string }) => {
        if (unmountedRef.current) return
        console.error('Report snapshot error:', error.message)
      },
    )

    return () => {
      unmountedRef.current = true
      unsubscribe()
    }
  }, [reportRef, queryClient])

  return useQuery<ReportData | null>({
    queryKey: ['reports', reportRef],
    queryFn: () => (queryClient.getQueryData(['reports', reportRef]) as ReportData | null) ?? null,
    staleTime: Infinity,
    gcTime: 5 * 60 * 1000,
    retry: false,
  })
}
