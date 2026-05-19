import { onCall, HttpsError, type CallableRequest } from 'firebase-functions/v2/https'
import { Firestore } from 'firebase-admin/firestore'
import { BantayogError, BantayogErrorCode } from '@bantayog/shared-validators'
import { adminDb } from '../admin-init.js'
import { bantayogErrorToHttps } from './https-error.js'

export interface GetOpsMetricsCoreDeps {
  timeRange: '1h' | '24h' | '7d'
  actor: { claims: { role?: string; municipalityId?: string; agencyId?: string } }
}

interface Scope {
  type: 'municipality' | 'agency' | 'province'
  id: string
}

function deriveScope(claims: GetOpsMetricsCoreDeps['actor']['claims']): Scope {
  const role = claims.role
  if (role === 'municipal_admin')
    return { type: 'municipality', id: claims.municipalityId ?? 'unknown' }
  if (role === 'agency_admin') return { type: 'agency', id: claims.agencyId ?? 'unknown' }
  if (role === 'provincial_superadmin') return { type: 'province', id: 'province' }
  throw new BantayogError(BantayogErrorCode.FORBIDDEN, 'unknown role')
}

export async function getOpsMetricsCore(db: Firestore, deps: GetOpsMetricsCoreDeps) {
  const scope = deriveScope(deps.actor.claims)

  const now = new Date()
  const dates: string[] = []
  if (deps.timeRange === '1h') {
    dates.push(now.toISOString().slice(0, 10))
  } else if (deps.timeRange === '24h') {
    dates.push(now.toISOString().slice(0, 10))
  } else {
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now)
      d.setDate(d.getDate() - i)
      dates.push(d.toISOString().slice(0, 10))
    }
  }

  const metrics = {
    totalDispatches: 0,
    acceptedCount: 0,
    declinedCount: 0,
    escalatedCount: 0,
    needsAdminCount: 0,
    fcmSuccessCount: 0,
    fcmFailureCount: 0,
    totalAcceptSeconds: 0,
    acceptCountWithTimestamps: 0,
  }

  for (const date of dates) {
    const docId = scope.type === 'province' ? 'province_' + date : scope.id + '_' + date
    const snap = await db.collection('metrics_daily').doc(docId).get()
    if (snap.exists) {
      const data = snap.data() as Partial<typeof metrics>
      metrics.totalDispatches += data.totalDispatches ?? 0
      metrics.acceptedCount += data.acceptedCount ?? 0
      metrics.declinedCount += data.declinedCount ?? 0
      metrics.escalatedCount += data.escalatedCount ?? 0
      metrics.needsAdminCount += data.needsAdminCount ?? 0
      metrics.fcmSuccessCount += data.fcmSuccessCount ?? 0
      metrics.fcmFailureCount += data.fcmFailureCount ?? 0
      metrics.totalAcceptSeconds += data.totalAcceptSeconds ?? 0
      metrics.acceptCountWithTimestamps += data.acceptCountWithTimestamps ?? 0
    }
  }

  return {
    timeRange: deps.timeRange,
    scope,
    metrics: {
      ...metrics,
      avgAcceptSeconds:
        metrics.acceptCountWithTimestamps > 0
          ? Math.round(metrics.totalAcceptSeconds / metrics.acceptCountWithTimestamps)
          : null,
      fcmSuccessRate:
        metrics.fcmSuccessCount + metrics.fcmFailureCount > 0
          ? metrics.fcmSuccessCount / (metrics.fcmSuccessCount + metrics.fcmFailureCount)
          : 0,
    },
  }
}

export const getOpsMetrics = onCall(
  {
    region: 'asia-southeast1',
    enforceAppCheck: true,
    maxInstances: 100,
  },
  async (req: CallableRequest<unknown>) => {
    if (!req.auth) throw new HttpsError('unauthenticated', 'sign-in required')
    const claims = req.auth.token
    if (
      claims.role !== 'municipal_admin' &&
      claims.role !== 'agency_admin' &&
      claims.role !== 'provincial_superadmin'
    ) {
      throw new HttpsError('permission-denied', 'admin required')
    }

    try {
      const data = req.data as Record<string, unknown>
      if (typeof data !== 'object') {
        throw new HttpsError('invalid-argument', 'malformed payload')
      }
      const timeRange = data.timeRange as '1h' | '24h' | '7d'
      return await getOpsMetricsCore(adminDb, {
        timeRange,
        actor: {
          claims: {
            role: claims.role as string,
            municipalityId: claims.municipalityId as string,
            agencyId: claims.agencyId as string,
          },
        },
      })
    } catch (err: unknown) {
      if (err instanceof BantayogError) {
        throw bantayogErrorToHttps(err)
      }
      throw err
    }
  },
)
