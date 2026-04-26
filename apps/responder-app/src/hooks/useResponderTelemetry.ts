import { useEffect, useRef } from 'react'
import { ref, set } from 'firebase/database'
import { doc, setDoc } from 'firebase/firestore'
import { useAuth } from '@bantayog/shared-ui'
import { rtdb, db } from '../app/firebase'
import { startTracking, stopTracking, getBatteryPercentage } from '../services/telemetry-client'
import { responderTelemetryPayloadSchema } from '@bantayog/shared-validators'
import type { TelemetryLocation } from '../services/telemetry-client'

const APP_VERSION = import.meta.env.VITE_APP_VERSION ?? 'unknown'

function deriveMotionState(speed: number | null): 'moving' | 'walking' | 'still' | 'unknown' {
  if (speed === null) return 'unknown'
  if (speed >= 2.5) return 'moving'
  if (speed >= 0.5) return 'walking'
  return 'still'
}

function getIntervalMs(
  motionState: 'moving' | 'walking' | 'still' | 'unknown',
  batteryLow: boolean,
): number {
  let base: number
  switch (motionState) {
    case 'moving':
      base = 15_000
      break
    case 'walking':
      base = 30_000
      break
    case 'still':
      base = 120_000
      break
    case 'unknown':
      base = 30_000
      break
  }
  return batteryLow ? Math.min(base * 2, 120_000) : base
}

export function useResponderTelemetry(
  uid: string | undefined,
  dispatchId: string | undefined,
  dispatchStatus: string | undefined,
) {
  const { claims } = useAuth()
  const lastWriteRef = useRef<number>(0)

  const isActive =
    typeof dispatchStatus === 'string' &&
    ['accepted', 'acknowledged', 'en_route', 'on_scene'].includes(dispatchStatus)

  useEffect(() => {
    lastWriteRef.current = 0

    if (!uid || !dispatchId || !isActive) {
      return
    }

    let cancelled = false

    const handleLocation = (loc: TelemetryLocation) => {
      if (cancelled) return

      void (async () => {
        const motionState = deriveMotionState(loc.speed)
        let batteryPct: number
        try {
          batteryPct = await getBatteryPercentage()
        } catch {
          batteryPct = 100
        }
        const batteryLow = batteryPct < 20
        const intervalMs = getIntervalMs(motionState, batteryLow)
        const now = Date.now()

        if (now - lastWriteRef.current < intervalMs) {
          return
        }
        lastWriteRef.current = now

        const telemetryStatus: 'active' | 'degraded' = batteryLow ? 'degraded' : 'active'
        const payload = {
          capturedAt: loc.capturedAt,
          lat: loc.lat,
          lng: loc.lng,
          accuracy: loc.accuracy,
          batteryPct,
          motionState,
          appVersion: APP_VERSION,
          telemetryStatus,
        }

        try {
          const validated = responderTelemetryPayloadSchema.parse(payload)
          await set(ref(rtdb, `responder_locations/${uid}`), validated)
          try {
            await setDoc(doc(db, 'responders', uid), { lastTelemetryAt: now }, { merge: true })
          } catch (fsErr: unknown) {
            console.error(
              '[useResponderTelemetry] Firestore lastTelemetryAt write failed (RTDB updated):',
              { uid, now, error: fsErr },
            )
          }

          // Fire-and-forget metadata write for projection job
          const municipalityId = claims?.municipalityId
          const agencyId = claims?.agencyId
          if (typeof municipalityId === 'string' && typeof agencyId === 'string') {
            set(ref(rtdb, `responder_index/${uid}`), { municipalityId, agencyId }).catch(
              (err: unknown) => {
                console.error('[useResponderTelemetry] responder_index write failed:', err)
              },
            )
          }
        } catch (err: unknown) {
          console.error('[useResponderTelemetry] write failed:', err)
        }
      })()
    }

    void startTracking(dispatchId, handleLocation).catch((err: unknown) => {
      console.error('[useResponderTelemetry] startTracking failed:', err)
    })

    return () => {
      cancelled = true
      void stopTracking()
    }
  }, [uid, dispatchId, isActive, claims])
}
