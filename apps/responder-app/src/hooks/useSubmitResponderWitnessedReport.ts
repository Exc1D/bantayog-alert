import { useEffect, useRef, useState } from 'react'
import { httpsCallable } from 'firebase/functions'
import { auth, functions } from '../app/firebase'
import { awaitFreshAuthToken } from '../app/await-auth-token'

interface SubmitResponderWitnessedReportRequest {
  dispatchId: string
  reportType: string
  description: string
  severity: string
  publicLocation: { lat: number; lng: number }
  photoUrl?: string
  idempotencyKey: string
}

export function useSubmitResponderWitnessedReport(dispatchId: string) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | undefined>()
  const keyRef = useRef(crypto.randomUUID())

  useEffect(() => {
    keyRef.current = crypto.randomUUID()
  }, [dispatchId])

  async function submit(payload: {
    reportType: string
    description: string
    severity: string
    photoUrl?: string
  }) {
    const normalizedDispatchId = dispatchId.trim()
    if (!normalizedDispatchId) {
      const err = new Error('dispatch_id_required')
      setError(err)
      throw err
    }
    const normalizedDescription = payload.description.trim()
    const normalizedPhotoUrl = payload.photoUrl?.trim()
    if (normalizedPhotoUrl) {
      try {
        const url = new URL(normalizedPhotoUrl)
        if (url.protocol !== 'http:' && url.protocol !== 'https:') {
          throw new Error('invalid protocol')
        }
      } catch {
        const err = new Error('photo_url_invalid')
        setError(err)
        throw err
      }
    }
    const allowedSeverity = new Set(['low', 'medium', 'high'])
    const allowedReportTypes = new Set([
      'flood',
      'fire',
      'earthquake',
      'typhoon',
      'landslide',
      'storm_surge',
      'medical',
      'accident',
      'structural',
      'security',
      'other',
    ])
    if (
      !payload.reportType ||
      !allowedReportTypes.has(payload.reportType) ||
      !normalizedDescription ||
      !allowedSeverity.has(payload.severity)
    ) {
      const err = new Error('required_fields_missing')
      setError(err)
      throw err
    }
    setLoading(true)
    setError(undefined)
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
        })
      })
      const publicLocation = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      }
      const user = await awaitFreshAuthToken(auth)
      if (!user) throw new Error('auth_required')
      const fn = httpsCallable<
        SubmitResponderWitnessedReportRequest,
        { reportId: string; publicTrackingRef: string }
      >(functions, 'submitResponderWitnessedReport')
      await fn({
        dispatchId: normalizedDispatchId,
        reportType: payload.reportType,
        description: normalizedDescription,
        severity: payload.severity,
        ...(normalizedPhotoUrl ? { photoUrl: normalizedPhotoUrl } : {}),
        publicLocation,
        idempotencyKey: keyRef.current,
      })
    } catch (err: unknown) {
      const normalized = err instanceof Error ? err : new Error(String(err))
      console.error('[useSubmitResponderWitnessedReport] submit failed:', normalized)
      setError(normalized)
      throw normalized
    } finally {
      setLoading(false)
    }
  }

  return { submit, loading, error }
}
