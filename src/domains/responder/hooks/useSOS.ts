/**
 * useSOS Hook — Responder SOS Emergency Signal
 *
 * Manages the SOS emergency activation and cancellation lifecycle.
 * Uses a Firestore transaction mutex pattern to prevent duplicate SOS events.
 * GPS location is tracked continuously once activated.
 */

import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import {
  runTransaction,
  doc,
  collection,
  query,
  where,
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
  gpsError: string | null
  canCancel: boolean
}

export function useSOS(): UseSOSReturn {
  const [sosState, setSosState] = useState<SOSEvent | null>(null)
  const [error, setError] = useState<SOSError | null>(null)
  const [locationSharing, setLocationSharing] = useState(false)
  const [gpsError, setGpsError] = useState<string | null>(null)

  const geoWatchIdRef = useRef<number | null>(null)
  const locationCacheRef = useRef<RichLocation | null>(null)
  const dbRef = useRef<ReturnType<typeof getFirestore> | null>(null)

  const canCancel = useMemo(
    () =>
      sosState !== null &&
      Date.now() - sosState.activatedAt < SOS_CANCELLATION_WINDOW_MS &&
      sosState.status !== 'cancelled' &&
      sosState.status !== 'expired',
    [sosState]
  )

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
        setLocationSharing(false)
        setGpsError(err.message ?? 'GPS tracking failed')
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
        code: (validation.code ?? 'VALIDATION_FAILED') as SOSError['code'],
        message: validation.message ?? 'SOS activation failed',
      })
      return
    }

    const now = Date.now()
    let location = locationCacheRef.current

    if (!location) {
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
          navigator.geolocation?.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 10_000,
            maximumAge: 0,
          }) ?? reject(new Error('Geolocation not supported'))
        )
        location = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          altitude: pos.coords.altitude ?? null,
          altitudeAccuracy: pos.coords.altitudeAccuracy ?? null,
          heading: pos.coords.heading ?? null,
          speed: pos.coords.speed ?? null,
          timestamp: Date.now(),
          source: 'gps',
        }
      } catch (err: unknown) {
        const geolocationErr = err as { code?: number | string; message?: string }
        if (geolocationErr.code === 1 || geolocationErr.code === 'PERMISSION_DENIED') {
          setError({
            code: 'PERMISSION_DENIED',
            message: 'Location permission denied. Please enable location access in your browser settings.',
          })
          return
        }
        setError({
          code: 'GPS_TIMEOUT',
          message: 'Unable to get your location. Move to an open area and try again.',
        })
        return
      }
    }

    // Validate GPS before writing
    const gpsValidation = validateGPSLocation(location)
    if (!gpsValidation.valid) {
      setError({
        code: (gpsValidation.code ?? 'VALIDATION_FAILED') as SOSError['code'],
        message: gpsValidation.message ?? 'Invalid GPS location',
      })
      return
    }

    try {
      // Get or create cached Firestore instance
      if (!dbRef.current) {
        dbRef.current = getFirestore()
      }
      const db = dbRef.current

      // Direct Firestore transaction for safety-critical SOS (NOT queued)
      await runTransaction(db, async (transaction) => {
        const user = getAuth().currentUser
        if (!user) {
          throw new Error('User not authenticated')
        }

        // Mutex: check for existing active SOS for this responder
        const existingSosQuery = query(
          collection(db, 'sos_events'),
          where('responderId', '==', user.uid),
          where('status', '==', 'active')
        )
        const existingSnap = await transaction.get(existingSosQuery as unknown as Parameters<typeof transaction.get>[0]) as unknown as { empty: boolean }
        if (!existingSnap.empty) {
          throw new Error('SOS already active')
        }

        // Create new SOS event with auto-generated ID
        const sosRef = doc(collection(db, 'sos_events'))

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

        // State update must happen AFTER transaction commits, not inside it
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
      const errorId = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36)
      console.error(`[SOS_ERROR][${errorId}] activateSOS failed`, err)
      const errCode = (err as { code?: string }).code
      const message = err instanceof Error ? err.message : 'Failed to activate SOS'

      // Map Firestore structured error codes — check err.code first (stable) over string matching (fragile)
      if (errCode === 'already-exists' || message.includes('already active')) {
        setError({ code: 'ALREADY_ACTIVE', message })
      } else if (errCode === 'permission-denied' || message.includes('permission') || message.includes('not authenticated')) {
        setError({ code: 'PERMISSION_DENIED', message })
      } else if (errCode === 'deadline-exceeded' || errCode === 'unavailable') {
        // Transient — retry once with 1s backoff
        await new Promise<void>((resolve) => setTimeout(resolve, 1_000))
        try {
          if (!dbRef.current) dbRef.current = getFirestore()
          await runTransaction(dbRef.current, async (transaction) => {
            const user = getAuth().currentUser
            if (!user) throw new Error('User not authenticated')
            const existingSosQuery = query(
              collection(dbRef.current!, 'sos_events'),
              where('responderId', '==', user.uid),
              where('status', '==', 'active')
            )
            const existingSnap = await transaction.get(existingSosQuery as unknown as Parameters<typeof transaction.get>[0]) as unknown as { empty: boolean }
            if (!existingSnap.empty) throw new Error('SOS already active')
            const sosRef = doc(collection(dbRef.current!, 'sos_events'))
            transaction.set(sosRef, {
              type: 'sos',
              status: 'active',
              responderId: user.uid,
              location,
              activatedAt: now,
              expiresAt: now + SOS_EXPIRATION_MS,
              cancellationWindowEndsAt: now + SOS_CANCELLATION_WINDOW_MS,
              timeline: [{ type: 'status_change', from: null, to: 'active', timestamp: now, actor: 'responder', actorId: user.uid }],
            })
            setSosState({ id: sosRef.id, status: 'active', responderId: user.uid, activatedAt: now, expiresAt: now + SOS_EXPIRATION_MS, cancellationWindowEndsAt: now + SOS_CANCELLATION_WINDOW_MS, location })
          })
          startLocationSharing()
          return
        } catch (retryErr: unknown) {
          console.error(`[SOS_ERROR][${errorId}] activateSOS retry failed`, retryErr)
          const retryMessage = retryErr instanceof Error ? retryErr.message : 'Failed to activate SOS'
          setError({ code: 'NETWORK_ERROR', message: retryMessage })
          return
        }
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

        if (!dbRef.current) {
          dbRef.current = getFirestore()
        }
        const db = dbRef.current

        await runTransaction(db, async (transaction) => {
          const user = getAuth().currentUser
          if (!user) {
            throw new Error('User not authenticated')
          }

          const sosRef = doc(db, 'sos_events', sosState.id)
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
        })

        // State update must happen AFTER transaction commits, not inside it
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

        stopLocationSharing()
      } catch (err: unknown) {
        const errorId = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36)
        console.error(`[SOS_ERROR][${errorId}] cancelSOS failed`, err)
        const errCode = (err as { code?: string }).code
        const message = err instanceof Error ? err.message : 'Failed to cancel SOS'

        if (errCode === 'permission-denied') {
          setError({ code: 'PERMISSION_DENIED', message })
        } else if (errCode === 'not-found' || message.includes('not found')) {
          setError({ code: 'SOS_NOT_FOUND', message })
        } else if (message.includes('window') || message.includes('expired')) {
          setError({ code: 'CANCEL_WINDOW_EXPIRED', message })
        } else if (errCode === 'deadline-exceeded' || errCode === 'unavailable') {
          // Transient — retry once with 1s backoff
          await new Promise<void>((resolve) => setTimeout(resolve, 1_000))
          try {
            if (!dbRef.current) dbRef.current = getFirestore()
            const retrySosRef = doc(dbRef.current, 'sos_events', sosState.id)
            await runTransaction(dbRef.current, async (transaction) => {
              const user = getAuth().currentUser
              if (!user) throw new Error('User not authenticated')
              const sosSnap = await transaction.get(retrySosRef)
              if (!sosSnap.exists()) throw new Error('SOS document not found')
              if (Date.now() > sosSnap.data().cancellationWindowEndsAt) throw new Error('Cancellation window has expired')
              transaction.update(retrySosRef, {
                status: 'cancelled',
                cancelledAt: Date.now(),
                cancellationReason: reason,
                timeline: arrayUnion({ type: 'status_change', from: 'active', to: 'cancelled', timestamp: Date.now(), actor: 'responder', actorId: user.uid }),
              })
            })
            setSosState((prev) => prev ? { ...prev, status: 'cancelled', cancelledAt: Date.now(), cancellationReason: reason } : null)
            stopLocationSharing()
            return
          } catch (retryErr: unknown) {
            console.error(`[SOS_ERROR][${errorId}] cancelSOS retry failed`, retryErr)
            const retryMessage = retryErr instanceof Error ? retryErr.message : 'Failed to cancel SOS'
            setError({ code: 'NETWORK_ERROR', message: retryMessage })
            return
          }
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

  // Honor expiresAt — stop GPS sharing when SOS expires
  useEffect(() => {
    if (!sosState || sosState.status !== 'active') return

    const expiresIn = sosState.expiresAt - Date.now()
    if (expiresIn <= 0) {
      // Already expired — stop immediately
      stopLocationSharing()
      return
    }

    const timer = setTimeout(() => {
      stopLocationSharing()
    }, expiresIn)

    return () => clearTimeout(timer)
  }, [sosState?.expiresAt, sosState?.status, stopLocationSharing])

  return { activateSOS, cancelSOS, sosState, error, locationSharing, gpsError, canCancel }
}
