import { useEffect, useState } from 'react'
import { collection, limit, onSnapshot, orderBy, query, where } from 'firebase/firestore'
import { db } from '../app/firebase'
import { toMillis } from '../lib/to-millis'

export interface PublicFeedItem {
  id: string
  reportType: string
  severity: string
  status: string
  barangayId: string
  municipalityLabel: string
  description: string
  publicLocation?: { lat: number; lng: number }
  submittedAtMillis: number
  verifiedAtMillis?: number
  featuredMediaUrls?: string[]
}

function parsePublicLocation(value: unknown): { lat: number; lng: number } | undefined {
  if (typeof value !== 'object' || value === null) return undefined
  const location = value as Record<string, unknown>
  const lat =
    typeof location.lat === 'number'
      ? location.lat
      : typeof location.latitude === 'number'
        ? location.latitude
        : undefined
  const lng =
    typeof location.lng === 'number'
      ? location.lng
      : typeof location.longitude === 'number'
        ? location.longitude
        : undefined
  if (lat === undefined || lng === undefined) return undefined
  return { lat, lng }
}

function readStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined
  const strings = value.filter((item): item is string => typeof item === 'string')
  return strings.length > 0 ? strings : undefined
}

function readString(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback
}

function mapPublicFeedItem(id: string, data: Record<string, unknown>): PublicFeedItem {
  const item: PublicFeedItem = {
    id,
    reportType: readString(data.reportType, 'other'),
    severity: readString(data.severity, 'low'),
    status: readString(data.status, 'verified'),
    barangayId: readString(data.barangayId, ''),
    municipalityLabel: readString(data.municipalityLabel, ''),
    description: readString(data.description, ''),
    submittedAtMillis: toMillis(data.submittedAt) ?? 0,
  }
  const publicLocation = parsePublicLocation(data.publicLocation)
  if (publicLocation !== undefined) {
    item.publicLocation = publicLocation
  }
  const verifiedAtMillis = toMillis(data.verifiedAt)
  if (verifiedAtMillis !== undefined) {
    item.verifiedAtMillis = verifiedAtMillis
  }
  const featuredMediaUrls = readStringArray(data.featuredMediaUrls)
  if (featuredMediaUrls !== undefined) {
    item.featuredMediaUrls = featuredMediaUrls
  }
  return item
}

export function usePublicFeed(): {
  items: PublicFeedItem[]
  loading: boolean
  error: string | null
  retry: () => void
  lastUpdatedAt: number | null
} {
  const [items, setItems] = useState<PublicFeedItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null)
  const [retryCount, setRetryCount] = useState(0)

  const retry = () => {
    setRetryCount((c) => c + 1)
  }

  useEffect(() => {
    const publicReportsQuery = query(
      collection(db, 'reports'),
      where('visibilityClass', '==', 'public_alertable'),
      orderBy('submittedAt', 'desc'),
      limit(50),
    )

    return onSnapshot(
      publicReportsQuery,
      (snap) => {
        setItems(
          snap.docs.map((docSnap) =>
            mapPublicFeedItem(docSnap.id, docSnap.data() as Record<string, unknown>),
          ),
        )
        setLoading(false)
        setError(null)
        setLastUpdatedAt(Date.now())
      },
      (err) => {
        setError(err instanceof Error ? err.message : 'Failed to load public feed')
        setLoading(false)
      },
    )
  }, [retryCount])

  return { items, loading, error, retry, lastUpdatedAt }
}
