/**
 * useAlerts Hook
 *
 * Fetches official government alerts from Firestore.
 * Filters out expired alerts client-side to avoid a Firestore composite index.
 */

import { useQuery } from '@tanstack/react-query'
import { orderBy, limit } from 'firebase/firestore'
import { getCollection } from '@/shared/services/firestore.service'
import type { Alert } from '@/shared/types/firestore.types'

const ALERTS_LIMIT = 50

export interface UseAlertsResult {
  data: Alert[] | undefined
  isLoading: boolean
  isError: boolean
  isRefetching: boolean
  refetch: () => void
}

export function useAlerts(): UseAlertsResult {
  const query = useQuery({
    queryKey: ['alerts'],
    queryFn: fetchAlerts,
    staleTime: 60 * 1000, // 1 minute
    refetchInterval: 2 * 60 * 1000, // Poll every 2 minutes
  })

  return {
    data: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    isRefetching: query.isRefetching ?? false,
    refetch: query.refetch,
  }
}

async function fetchAlerts(): Promise<Alert[]> {
  const now = Date.now()
  const alerts = await getCollection<Alert>('alerts', [
    orderBy('createdAt', 'desc'),
    limit(ALERTS_LIMIT),
  ])
  // Filter expired alerts client-side — avoids needing a composite Firestore index
  return alerts.filter((a) => !a.expiresAt || a.expiresAt > now)
}
