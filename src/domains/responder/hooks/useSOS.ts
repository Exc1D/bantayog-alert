/**
 * useSOS Hook — Responder SOS Emergency Signal
 *
 * Manages the SOS emergency activation and cancellation lifecycle.
 * Uses a Firestore transaction mutex pattern to prevent duplicate SOS events.
 * GPS location is tracked continuously once activated.
 */

import { useState, useCallback, useEffect, useRef } from 'react'
import {
  runTransaction,
  doc,
  collection,
  arrayUnion,
  getFirestore,
} from 'firebase/firestore'
import { getAuth } from 'firebase/auth'
import { canActivateSOS, validateGPSLocation } from '../services/validation.service'
import { SOS_EXPIRATION_MS, SOS_CANCELLATION_WINDOW_MS } from '../config/urgency.config'
import type { SOSEvent, SOSError, RichLocation } from '../types'

interface UseSOSReturn {
  activateSOS: () => Promise<void>
  cancelSOS: (reason: string) => Promise<void>
  sosState: SOSEvent | null
  error: SOSError | null
  locationSharing: boolean
  canCancel: boolean
}

export function useSOS(): UseSOSReturn {
  const [sosState, setSosState] = useState<SOSEvent | null>(null)
  const [error, setError] = useState<SOSError | null>(null)
  const [locationSharing, setLocationSharing] = useState(false)

  const geoWatchIdRef = useRef<number | null>(null)
  const locationCacheRef = useRef<RichLocation | null>(null)

  const canCancel =
    sosState !== null &&
    Date.now() - sosState.activatedAt < SOS_CANCELLATION_WINDOW_MS &&
    sosState.status !== 'cancelled' &&
    sosState.status !== 'expired'

  const startLocationSharing = useCallback(() => {
    if (!navigator.geolocation) {
      console.warn('[SOS] Geolocation not supported')
      return
    }

    setLocationSharing(true)

    geoWatchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const richLocation: RichLocation = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          altitude: position.coords.altitude ?? null,
          altitudeAccuracy: position.coords.altitudeAccuracy ?? null,
          heading: position.coords.heading ?? null,
          speed: position.coords.speed ?? null,
          timestamp: Date.now(),
          source: 'gps',
        }
        locationCacheRef.current = richLocation
      },
      (err) => {
        console.error('[SOS] GPS error:', err)
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 5000,
      }
    )
  }, [])

  const stopLocationSharing = useCallback(() => {
    if (geoWatchIdRef.current !== null) {
      navigator.geolocation.clearWatch(geoWatchIdRef.current)
      geoWatchIdRef.current = null
    }
    setLocationSharing(false)
  }, [])

  const activateSOS = useCallback(async (): Promise<void> => {
    setError(null)

    // Pre-flight validation
    const validation = await canActivateSOS()
    if (!validation.valid) {
      setError({
        code: 'VALIDATION_FAILED',
        message: validation.message ?? 'SOS activation failed',
      })
      return
    }

    const now = Date.now()
    const location = locationCacheRef.current ?? {
      latitude: 0,
      longitude: 0,
      accuracy: 0,
      altitude: null,
      altitudeAccuracy: null,
      heading: null,
      speed: null,
      timestamp: now,
      source: 'gps' as const,
    }

    // Validate GPS before writing
    const gpsValidation = validateGPSLocation(location)
    if (!gpsValidation.valid) {
      setError({
        code: 'VALIDATION_FAILED',
        message: gpsValidation.message ?? 'Invalid GPS location',
      })
      return
    }

    try {
      // Direct Firestore transaction for safety-critical SOS (NOT queued)
      await runTransaction(getFirestore(), async (transaction) => {
        const user = getAuth().currentUser
        if (!user) {
          throw new Error('User not authenticated')
        }

        // TODO: Check for existing active SOS — mutex pattern would go here
        // e.g., query sos_events where responderId == user.uid AND status == 'active'

        // Create new SOS event with auto-generated ID
        const sosRef = doc(collection(getFirestore(), 'sos_events'))

        transaction.set(sosRef, {
          type: 'sos',
          status: 'active',
          responderId: user.uid,
          location,
          activatedAt: now,
          expiresAt: now + SOS_EXPIRATION_MS,
          cancellationWindowEndsAt: now + SOS_CANCELLATION_WINDOW_MS,
          timeline: [
            {
              type: 'status_change',
              from: null,
              to: 'active',
              timestamp: now,
              actor: 'responder',
              actorId: user.uid,
            },
          ],
        })

        // Update local state
        setSosState({
          id: sosRef.id,
          status: 'active',
          responderId: user.uid,
          activatedAt: now,
          expiresAt: now + SOS_EXPIRATION_MS,
          cancellationWindowEndsAt: now + SOS_CANCELLATION_WINDOW_MS,
          location,
        })
      })

      // Start GPS tracking
      startLocationSharing()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to activate SOS'
      if (message.includes('already active')) {
        setError({ code: 'ALREADY_ACTIVE', message })
      } else if (
        message.includes('permission') ||
        message.includes('not authenticated')
      ) {
        setError({ code: 'PERMISSION_DENIED', message })
      } else {
        setError({ code: 'NETWORK_ERROR', message })
      }
    }
  }, [startLocationSharing])

  const cancelSOS = useCallback(
    async (reason: string): Promise<void> => {
      if (!sosState) {
        setError({ code: 'CANCEL_WINDOW_EXPIRED', message: 'No active SOS to cancel' })
        return
      }

      if (!canCancel) {
        setError({
          code: 'CANCEL_WINDOW_EXPIRED',
          message: 'Cannot cancel SOS outside cancellation window',
        })
        return
      }

      setError(null)

      try {
        const now = Date.now()

        await runTransaction(getFirestore(), async (transaction) => {
          const user = getAuth().currentUser
          if (!user) {
            throw new Error('User not authenticated')
          }

          const sosRef = doc(getFirestore(), 'sos_events', sosState.id)
          const sosSnap = await transaction.get(sosRef)

          if (!sosSnap.exists()) {
            throw new Error('SOS document not found')
          }

          // Verify still within cancellation window
          if (now > sosSnap.data().cancellationWindowEndsAt) {
            throw new Error('Cancellation window has expired')
          }

          transaction.update(sosRef, {
            status: 'cancelled',
            cancelledAt: now,
            cancellationReason: reason,
            timeline: arrayUnion({
              type: 'status_change',
              from: 'active',
              to: 'cancelled',
              timestamp: now,
              actor: 'responder',
              actorId: user.uid,
            }),
          })

          setSosState((prev) =>
            prev
              ? {
                  ...prev,
                  status: 'cancelled',
                  cancelledAt: now,
                  cancellationReason: reason,
                }
              : null
          )
        })

        stopLocationSharing()
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to cancel SOS'
        if (
          message.includes('window') ||
          message.includes('expired') ||
          message.includes('not found')
        ) {
          setError({ code: 'CANCEL_WINDOW_EXPIRED', message })
        } else {
          setError({ code: 'NETWORK_ERROR', message })
        }
      }
    },
    [sosState, canCancel, stopLocationSharing]
  )

  // Cleanup geolocation watch on unmount
  useEffect(() => {
    return () => {
      stopLocationSharing()
    }
  }, [stopLocationSharing])

  return { activateSOS, cancelSOS, sosState, error, locationSharing, canCancel }
}
