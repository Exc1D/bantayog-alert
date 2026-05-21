import { onCall, type CallableRequest, HttpsError } from 'firebase-functions/v2/https'
import { z } from 'zod'

const unsubscribeSchema = z.object({
  token: z.string().min(1),
})

export interface UnsubscribeFromAlertsDeps {
  token: string
  actor: { uid: string }
}

export async function unsubscribeFromAlertsCore(
  deps: UnsubscribeFromAlertsDeps,
): Promise<{ success: true }> {
  const { messaging } = await import('firebase-admin')
  const response = await messaging().unsubscribeFromTopic([deps.token], 'alerts')
  if (response.failureCount > 0 && response.errors.length > 0) {
    const errors = response.errors
      .map((e) => (typeof e.error === 'string' ? e.error : JSON.stringify(e.error)))
      .join(', ')
    throw new Error(`Failed to unsubscribe from alerts topic: ${errors}`)
  }
  return { success: true }
}

export const unsubscribeFromAlerts = onCall(
  { region: 'asia-southeast1' },
  async (request: CallableRequest<unknown>) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Must be signed in')
    }

    const parsed = unsubscribeSchema.safeParse(request.data)
    if (!parsed.success) {
      throw new HttpsError('invalid-argument', 'malformed payload')
    }

    try {
      return await unsubscribeFromAlertsCore({
        token: parsed.data.token,
        actor: { uid: request.auth.uid },
      })
    } catch (error) {
      console.error('Failed to unsubscribe from alerts topic:', error)
      throw new HttpsError('internal', 'Failed to unsubscribe from alerts')
    }
  },
)
