import { useEffect, useRef } from 'react'
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query'
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
  const hasReportRef = reportRef !== ''

  useEffect(() => {
    if (!hasReportRef) return
    unmountedRef.current = false

    const unsubscribe = onSnapshot(
      doc(db(), `reports/${reportRef}`),
      (snapshot: DocumentSnapshot) => {
        if (unmountedRef.current) return
        if (snapshot.exists()) {
          const data = snapshot.data()
          try {
            queryClient.setQueryData(['reports', reportRef], mapReportFromFirestore(data))
          } catch (err: unknown) {
            console.error('Report mapping error:', err instanceof Error ? err.message : err)
            queryClient.setQueryData(['reports', reportRef], null)
          }
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
  }, [reportRef, queryClient, hasReportRef])

  return useQuery<ReportData | null>({
    queryKey: ['reports', reportRef],
    queryFn: async (): Promise<ReportData | null> => {
      const cached = queryClient.getQueryData(['reports', reportRef])
      if (cached !== undefined) return cached as ReportData | null
      if (!hasReportRef) return null
      return new Promise<ReportData | null>((resolve) => {
        const unsub = onSnapshot(
          doc(db(), `reports/${reportRef}`),
          (snap) => {
            if (!snap.exists()) {
              resolve(null)
              unsub()
              return
            }
            try {
              resolve(mapReportFromFirestore(snap.data()))
            } catch (err: unknown) {
              console.error('Report mapping error:', err instanceof Error ? err.message : err)
              resolve(null)
            }
            unsub()
          },
          (error) => {
            console.error('Report fetch error:', error.message)
            resolve(null)
            unsub()
          },
        )
      })
    },
    enabled: hasReportRef,
    placeholderData: keepPreviousData,
    staleTime: Infinity,
    gcTime: 5 * 60 * 1000,
    retry: false,
  })
}
