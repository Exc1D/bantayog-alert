import { useEffect, useState } from 'react'
import { collection, limit, onSnapshot, orderBy, query } from 'firebase/firestore'
import { db } from '../app/firebase'
import { toMillis } from '../lib/to-millis'

export interface OfficialAlertItem {
  id: string
  message: string
  hazardType: string
  affectedMunicipalityIds: string[]
  declaredAtMillis: number
  publishedAtMillis: number
  declaredBy: string
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string')
}

function readString(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback
}

function mapOfficialAlert(id: string, data: Record<string, unknown>): OfficialAlertItem {
  return {
    id,
    message: readString(data.message, ''),
    hazardType: readString(data.hazardType, 'other'),
    affectedMunicipalityIds: readStringArray(data.affectedMunicipalityIds),
    declaredAtMillis: toMillis(data.declaredAt) ?? 0,
    publishedAtMillis: toMillis(data.publishedAt) ?? 0,
    declaredBy: readString(data.declaredBy, ''),
  }
}

export function useOfficialAlerts(): {
  alerts: OfficialAlertItem[]
  loading: boolean
  error: string | null
  retry: () => void
  lastUpdatedAt: number
} {
  const [alerts, setAlerts] = useState<OfficialAlertItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [retryCount, setRetryCount] = useState(0)
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number>(0)

  const retry = () => {
    setRetryCount((c) => c + 1)
  }

  useEffect(() => {
    const officialAlertsQuery = query(
      collection(db, 'alerts'),
      orderBy('publishedAt', 'desc'),
      limit(20),
    )

    return onSnapshot(
      officialAlertsQuery,
      (snap) => {
        setAlerts(
          snap.docs.map((docSnap) =>
            mapOfficialAlert(docSnap.id, docSnap.data() as Record<string, unknown>),
          ),
        )
        setLoading(false)
        setError(null)
        setLastUpdatedAt(Date.now())
      },
      (err) => {
        setError(err instanceof Error ? err.message : 'Failed to load official alerts')
        setLoading(false)
      },
    )
  }, [retryCount])

  return { alerts, loading, error, retry, lastUpdatedAt }
}
