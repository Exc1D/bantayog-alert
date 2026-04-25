import { onDocumentCreated } from 'firebase-functions/v2/firestore'
import * as ngeohash from 'ngeohash'
import * as turf from '@turf/turf'
import type { QueryDocumentSnapshot } from 'firebase-admin/firestore'
import { adminDb } from '../admin-init.js'
import { logDimension } from '@bantayog/shared-validators'

const log = logDimension('duplicateClusterTrigger')

const NON_TERMINAL_STATUSES = [
  'new',
  'awaiting_verify',
  'verified',
  'assigned',
  'acknowledged',
  'en_route',
  'on_scene',
  'reopened',
]
const TWO_H_MS = 2 * 60 * 60 * 1000
const PROXIMITY_METERS = 200
const BATCH_CAP = 250

export async function duplicateClusterTriggerCore(
  db: FirebaseFirestore.Firestore,
  snap: QueryDocumentSnapshot,
): Promise<void> {
  const data = snap.data()
  const {
    locationGeohash,
    municipalityId,
    reportType,
    createdAt,
    duplicateClusterId: existingCluster,
  } = data

  if (typeof locationGeohash !== 'string' || locationGeohash.length < 6) return
  if (typeof municipalityId !== 'string' || municipalityId.length === 0) return
  if (typeof reportType !== 'string' || reportType.length === 0) return

  const nowMs: number = typeof createdAt === 'number' ? createdAt : Date.now()
  const cutoff = nowMs - TWO_H_MS

  const candidates = await db
    .collection('report_ops')
    .where('municipalityId', '==', municipalityId)
    .where('reportType', '==', reportType)
    .where('status', 'in', NON_TERMINAL_STATUSES)
    .where('createdAt', '>', cutoff)
    .orderBy('createdAt', 'desc')
    .limit(300)
    .get()

  const prefix = locationGeohash.slice(0, 6)
  const neighborPrefixes = new Set([prefix, ...ngeohash.neighbors(prefix)])
  let triggerPoint: { latitude: number; longitude: number }
  try {
    triggerPoint = ngeohash.decode(locationGeohash)
  } catch {
    return
  }
  const triggerCoord = turf.point([triggerPoint.longitude, triggerPoint.latitude])

  const nearby = candidates.docs.filter((d) => {
    if (d.id === snap.id) return false
    const gh = d.data().locationGeohash
    if (typeof gh !== 'string' || gh.length < 6) return false
    if (!neighborPrefixes.has(gh.slice(0, 6))) return false
    try {
      const pt = ngeohash.decode(gh)
      const dist = turf.distance(turf.point([pt.longitude, pt.latitude]), triggerCoord, {
        units: 'meters',
      })
      return dist <= PROXIMITY_METERS
    } catch {
      return false
    }
  })

  if (nearby.length === 0) return

  const existingClusterFromNearby = nearby.find((d) => d.data().duplicateClusterId)?.data()
    .duplicateClusterId as string | undefined
  const clusterId = existingCluster ?? existingClusterFromNearby ?? crypto.randomUUID()

  const needsUpdate = nearby.filter((d) => d.data().duplicateClusterId !== clusterId)
  const maxNearbyUpdates = existingCluster !== clusterId ? BATCH_CAP - 1 : BATCH_CAP
  const toUpdate = needsUpdate.slice(0, maxNearbyUpdates)

  if (needsUpdate.length > maxNearbyUpdates) {
    log({
      severity: 'WARNING',
      code: 'dup.cluster.truncated',
      message: `Truncated duplicate cluster from ${String(needsUpdate.length)} to ${String(maxNearbyUpdates)} docs`,
      data: { reportId: snap.id, nearbyCount: needsUpdate.length, batchCap: maxNearbyUpdates },
    })
  }

  if (toUpdate.length === 0 && existingCluster === clusterId) return

  const batch = db.batch()
  if (existingCluster !== clusterId) {
    batch.update(snap.ref, { duplicateClusterId: clusterId })
  }
  for (const d of toUpdate) {
    batch.update(d.ref, { duplicateClusterId: clusterId })
  }
  await batch.commit()

  log({
    severity: 'INFO',
    code: 'dup.cluster.assigned',
    message: `Assigned ${String(toUpdate.length + 1)} docs to cluster ${String(clusterId)}`,
  })
}

export const duplicateClusterTrigger = onDocumentCreated(
  { document: 'report_ops/{reportId}', region: 'asia-southeast1' },
  async (event) => {
    const snap = event.data
    if (!snap) return
    try {
      await duplicateClusterTriggerCore(adminDb, snap)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      log({
        severity: 'ERROR',
        code: 'dup.cluster.trigger_failed',
        message: `Duplicate cluster trigger failed for ${event.params.reportId}: ${message}`,
        data: { reportId: event.params.reportId, error: message },
      })
      throw err
    }
  },
)
