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

export interface ReportData {
  id: string
  status: ReportStatus
  timeline: ReportTimelineEvent[]
  type?: string
  severity?: string
  createdAt?: number
  updatedAt?: number
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
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        queryClient.setQueryError(['reports', reportRef], new Error(error.message))
      },
    )

    return () => {
      unmountedRef.current = true
      unsubscribe()
    }
  }, [reportRef, queryClient])

  return useQuery({
    queryKey: ['reports', reportRef],
    queryFn: () => queryClient.getQueryData(['reports', reportRef]) ?? null,
    staleTime: Infinity,
    gcTime: 5 * 60 * 1000,
    retry: false,
  })
}
