import { useEffect, useState } from 'react'
import { collection, onSnapshot, query, where, Timestamp } from 'firebase/firestore'
import { db } from '../app/firebase'
import { ACTIVE_REPORT_STATUSES } from '@bantayog/shared-types'

export interface IncidentFeedItem {
  id: string
  location: { lat: number; lng: number }
  severity: 'critical' | 'high' | 'medium' | 'low'
  type: string
  municipality: string
  timestamp: Date
  status: string
}

export interface IncidentSubscriptionState {
  incidents: IncidentFeedItem[]
  loading: boolean
  error: string | null
}

const VALID_SEVERITIES = new Set(['critical', 'high', 'medium', 'low'])

function toSeverity(value: unknown): IncidentFeedItem['severity'] {
  const str = typeof value === 'string' ? value : 'medium'
  const normalized = str.toLowerCase()
  if (VALID_SEVERITIES.has(normalized)) {
    return normalized as IncidentFeedItem['severity']
  }
  return 'medium'
}

function parseLocation(data: Record<string, unknown>): { lat: number; lng: number } | null {
  const location = data.publicLocation as { lat?: unknown; lng?: unknown } | undefined
  const lat = typeof location?.lat === 'number' ? location.lat : null
  const lng = typeof location?.lng === 'number' ? location.lng : null

  if (lat === null || lng === null) return null
  return { lat, lng }
}

function parseMunicipality(data: Record<string, unknown>): string {
  if (typeof data.municipalityLabel === 'string') return data.municipalityLabel
  if (typeof data.municipalityId === 'string') return data.municipalityId
  return 'Unknown'
}

function toIncidentFeedItem(id: string, data: Record<string, unknown>): IncidentFeedItem | null {
  const location = parseLocation(data)
  if (location === null) return null

  const createdAt = data.createdAt as Timestamp | undefined
  const timestamp = createdAt?.toDate() ?? new Date()

  return {
    id,
    location,
    severity: toSeverity(data.severity),
    type: typeof data.reportType === 'string' ? data.reportType : 'Unknown',
    municipality: parseMunicipality(data),
    timestamp,
    status: typeof data.status === 'string' ? data.status : 'new',
  }
}

export function useIncidentSubscription(): IncidentSubscriptionState {
  const [incidents, setIncidents] = useState<IncidentFeedItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const q = query(collection(db, 'reports'), where('status', 'in', ACTIVE_REPORT_STATUSES))

    const unsub = onSnapshot(
      q,
      (snap) => {
        const items = snap.docs
          .map((d) => toIncidentFeedItem(d.id, d.data()))
          .filter((item): item is IncidentFeedItem => item !== null)

        setIncidents(items)
        setLoading(false)
        setError(null)
      },
      (err) => {
        setError(err.message)
        setLoading(false)
      },
    )

    return unsub
  }, [])

  return { incidents, loading, error }
}
