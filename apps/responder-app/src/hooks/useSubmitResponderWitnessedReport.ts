import { httpsCallable } from 'firebase/functions'
import { functions } from '../app/firebase'
import { useCallableAction } from './useCallableAction'

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
  const { run, fail, loading, error } = useCallableAction(
    'useSubmitResponderWitnessedReport',
    dispatchId,
  )

  async function submit(payload: {
    reportType: string
    description: string
    severity: string
    photoUrl?: string
  }) {
    const normalizedDispatchId = dispatchId.trim()
    if (!normalizedDispatchId) {
      fail('dispatch_id_required')
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
        fail('photo_url_invalid')
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
      fail('required_fields_missing')
    }
    await run(async ({ idempotencyKey }) => {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
        })
      })
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
        publicLocation: { lat: position.coords.latitude, lng: position.coords.longitude },
        idempotencyKey,
      })
    })
  }

  return { submit, loading, error }
}
