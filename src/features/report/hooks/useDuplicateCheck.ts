/**
 * useDuplicateCheck Hook
 *
 * Checks for recent similar reports in the same area to alert users
 * of potential duplicates before submission.
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  Timestamp,
} from 'firebase/firestore'
import { db } from '@/app/firebase/config'

export interface DuplicateCheckParams {
  latitude: number
  longitude: number
  incidentType: string
  timeWindowMinutes?: number
  distanceThresholdKm?: number
}

export interface DuplicateReport {
  id: string
  createdAt: Date
  distanceKm: number
  report: Record<string, unknown>
}

interface UseDuplicateCheckResult {
  duplicates: DuplicateReport[]
  isChecking: boolean
  checkForDuplicates: () => Promise<void>
  clearDuplicates: () => void
}

const DISTANCE_THRESHOLD_KM = 0.5
const TIME_WINDOW_MINUTES = 30

export function useDuplicateCheck({
  latitude,
  longitude,
  incidentType,
  timeWindowMinutes = TIME_WINDOW_MINUTES,
  distanceThresholdKm = DISTANCE_THRESHOLD_KM,
}: DuplicateCheckParams): UseDuplicateCheckResult {
  const [duplicates, setDuplicates] = useState<DuplicateReport[]>([])
  const [isChecking, setIsChecking] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const checkForDuplicates = useCallback(async () => {
    if (!latitude || !longitude) return

    setIsChecking(true)

    try {
      const windowStart = Timestamp.fromDate(
        new Date(Date.now() - timeWindowMinutes * 60 * 1000)
      )

      const reportsRef = collection(db, 'reports')
      const q = query(
        reportsRef,
        where('incidentType', '==', incidentType),
        where('createdAt', '>=', windowStart),
        orderBy('createdAt', 'desc'),
        limit(10)
      )

      const snapshot = await getDocs(q)
      const duplicateReports: DuplicateReport[] = []

      snapshot.forEach((docSnapshot) => {
        const data = docSnapshot.data()
        if (data.approximateLocation?.approximateCoordinates) {
          const reportLat = data.approximateLocation.approximateCoordinates.latitude
          const reportLng = data.approximateLocation.approximateCoordinates.longitude

          const distance = calculateDistance(latitude, longitude, reportLat, reportLng)

          if (distance <= distanceThresholdKm) {
            duplicateReports.push({
              id: docSnapshot.id,
              createdAt: data.createdAt.toDate(),
              distanceKm: Math.round(distance * 100) / 100,
              report: data as Record<string, unknown>,
            })
          }
        }
      })

      setDuplicates(duplicateReports)
    } catch (error) {
      // Duplicate check failures are non-fatal — show no duplicates.
      // Use an errorId prefix for traceability in logs.
      const errorId = 'DUPLICATE_CHECK_ERROR'
      console.error(`[${errorId}] Duplicate check failed:`, error)
      setDuplicates([])
    } finally {
      setIsChecking(false)
    }
  }, [latitude, longitude, incidentType, timeWindowMinutes, distanceThresholdKm])

  const clearDuplicates = useCallback(() => {
    setDuplicates([])
  }, [])

  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }

    debounceRef.current = setTimeout(() => {
      checkForDuplicates()
    }, 1000)

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [latitude, longitude, checkForDuplicates])

  return {
    duplicates,
    isChecking,
    checkForDuplicates,
    clearDuplicates,
  }
}

function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180)
}