import { onCall, HttpsError, type CallableRequest } from 'firebase-functions/v2/https'
import { Firestore } from 'firebase-admin/firestore'
import { BantayogError, BantayogErrorCode } from '@bantayog/shared-validators'
import { adminDb } from '../../admin-init.js'
import { bantayogErrorToHttps } from '../../callables/https-error.js'
import { shouldEnforceAppCheck } from '../../callables/app-check-config.js'

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

function collectDatesForRange(timeRange: '1h' | '24h' | '7d'): string[] {
  const now = new Date()
  if (timeRange === '1h' || timeRange === '24h') {
    return [now.toISOString().slice(0, 10)]
  }
  const dates: string[] = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    dates.push(d.toISOString().slice(0, 10))
  }
  return dates
}

interface DailyMetrics {
  totalDispatches: number
  acceptedCount: number
  declinedCount: number
  escalatedCount: number
  needsAdminCount: number
  fcmSuccessCount: number
  fcmFailureCount: number
  totalAcceptSeconds: number
  acceptCountWithTimestamps: number
}

function createEmptyMetrics(): DailyMetrics {
  return {
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
}

function accumulateMetrics(accum: DailyMetrics, data: Partial<DailyMetrics>): void {
  accum.totalDispatches += data.totalDispatches ?? 0
  accum.acceptedCount += data.acceptedCount ?? 0
  accum.declinedCount += data.declinedCount ?? 0
  accum.escalatedCount += data.escalatedCount ?? 0
  accum.needsAdminCount += data.needsAdminCount ?? 0
  accum.fcmSuccessCount += data.fcmSuccessCount ?? 0
  accum.fcmFailureCount += data.fcmFailureCount ?? 0
  accum.totalAcceptSeconds += data.totalAcceptSeconds ?? 0
  accum.acceptCountWithTimestamps += data.acceptCountWithTimestamps ?? 0
}

export async function getOpsMetricsCore(db: Firestore, deps: GetOpsMetricsCoreDeps) {
  const scope = deriveScope(deps.actor.claims)
  const dates = collectDatesForRange(deps.timeRange)
  const metrics = createEmptyMetrics()

  for (const date of dates) {
    const docId = scope.type === 'province' ? `province_${date}` : `${scope.id}_${date}`
    const snap = await db.collection('metrics_daily').doc(docId).get()
    if (snap.exists) {
      accumulateMetrics(metrics, snap.data() as Partial<DailyMetrics>)
    }
  }

  const avgAcceptSeconds =
    metrics.acceptCountWithTimestamps > 0
      ? Math.round(metrics.totalAcceptSeconds / metrics.acceptCountWithTimestamps)
      : null

  const totalFcmAttempts = metrics.fcmSuccessCount + metrics.fcmFailureCount
  const fcmSuccessRate = totalFcmAttempts > 0 ? metrics.fcmSuccessCount / totalFcmAttempts : 0

  return {
    timeRange: deps.timeRange,
    scope,
    metrics: {
      ...metrics,
      avgAcceptSeconds,
      fcmSuccessRate,
    },
  }
}

const ADMIN_ROLES = ['municipal_admin', 'agency_admin', 'provincial_superadmin'] as const

export const getOpsMetrics = onCall(
  {
    region: 'asia-southeast1',
    enforceAppCheck: shouldEnforceAppCheck(),
    maxInstances: 100,
  },
  async (req: CallableRequest<unknown>) => {
    if (!req.auth) throw new HttpsError('unauthenticated', 'sign-in required')
    const claims = req.auth.token
    if (!ADMIN_ROLES.includes(claims.role as (typeof ADMIN_ROLES)[number])) {
      throw new HttpsError('permission-denied', 'admin required')
    }

    const data = req.data as Record<string, unknown> | null
    if (typeof data !== 'object' || data === null) {
      throw new HttpsError('invalid-argument', 'malformed payload')
    }
    const timeRange = data.timeRange as '1h' | '24h' | '7d'

    try {
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
