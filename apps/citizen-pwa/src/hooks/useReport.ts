import { useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { doc, onSnapshot, getDoc } from 'firebase/firestore'
import type { DocumentSnapshot } from 'firebase/firestore'
import { db } from '../services/firebase'
import { mapReportFromFirestore } from '../lib/mappers'
import type { ReportStatus } from '@bantayog/shared-types'

export interface ReportTimelineEvent {
  event: string
  timestamp: number
  actor?: string
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

export function useReport(publicRef: string) {
  const queryClient = useQueryClient()
  const unmountedRef = useRef(false)
  const hasPublicRef = publicRef !== ''

  // Resolve publicRef → reportId via report_lookup (publicly readable, allow read: if true)
  const [reportId, setReportId] = useState<string | null>(null)

  useEffect(() => {
    if (!hasPublicRef) return
    const unsubscribe = onSnapshot(
      doc(db(), `report_lookup/${publicRef}`),
      (snap) => {
        if (snap.exists()) {
          const id = snap.data().reportId as string | undefined
          if (id) setReportId(id)
        }
      },
      (error: { message: string }) => {
        console.error('Report lookup error:', error.message)
      },
    )
    return () => {
      unsubscribe()
    }
  }, [publicRef, hasPublicRef])

  // Live subscription to reports/{reportId} — pushes into React Query cache
  useEffect(() => {
    if (!reportId) return
    unmountedRef.current = false

    const unsubscribe = onSnapshot(
      doc(db(), `reports/${reportId}`),
      (snapshot: DocumentSnapshot) => {
        if (unmountedRef.current) return
        if (snapshot.exists()) {
          const data = snapshot.data()
          try {
            queryClient.setQueryData(
              ['reports', publicRef],
              mapReportFromFirestore(data, snapshot.id),
            )
          } catch (err: unknown) {
            console.error('Report mapping error:', err instanceof Error ? err.message : err)
            queryClient.setQueryData(['reports', publicRef], null)
          }
        } else {
          queryClient.setQueryData(['reports', publicRef], null)
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
  }, [reportId, queryClient, publicRef])

  return useQuery<ReportData | null>({
    queryKey: ['reports', publicRef],
    queryFn: async (): Promise<ReportData | null> => {
      const cached = queryClient.getQueryData(['reports', publicRef])
      if (cached !== undefined) return cached as ReportData | null
      if (!hasPublicRef) return null

      // One-shot lookup if the live subscription hasn't resolved reportId yet
      const lookupSnap = await getDoc(doc(db(), `report_lookup/${publicRef}`))
      if (!lookupSnap.exists()) return null
      const rId = lookupSnap.data().reportId as string | undefined
      if (!rId) return null

      return new Promise<ReportData | null>((resolve) => {
        const unsub = onSnapshot(
          doc(db(), `reports/${rId}`),
          (snap) => {
            if (!snap.exists()) {
              resolve(null)
              unsub()
              return
            }
            try {
              resolve(mapReportFromFirestore(snap.data(), snap.id))
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
    enabled: hasPublicRef,
    placeholderData: keepPreviousData,
    staleTime: Infinity,
    gcTime: 5 * 60 * 1000,
    retry: false,
  })
}
