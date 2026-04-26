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
        dispatchId,
        ...payload,
        publicLocation,
        idempotencyKey: keyRef.current,
      })
    } catch (err: unknown) {
      console.error('[useSubmitResponderWitnessedReport] submit failed:', err)
      if (err instanceof Error) setError(err)
      else setError(new Error(String(err)))
    } finally {
      setLoading(false)
    }
  }

  return { submit, loading, error }
}
