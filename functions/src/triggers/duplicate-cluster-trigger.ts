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

  if (!locationGeohash || typeof locationGeohash !== 'string') return

  const nowMs: number = typeof createdAt === 'number' ? createdAt : Date.now()
  const cutoff = nowMs - TWO_H_MS

  const candidates = await db
    .collection('report_ops')
    .where('municipalityId', '==', municipalityId)
    .where('reportType', '==', reportType)
    .where('status', 'in', NON_TERMINAL_STATUSES)
    .where('createdAt', '>', cutoff)
    .limit(300)
    .get()

  const prefix = locationGeohash.slice(0, 6)
  const neighborPrefixes = new Set([prefix, ...ngeohash.neighbors(prefix)])
  const triggerPoint = ngeohash.decode(locationGeohash)
  const triggerCoord = turf.point([triggerPoint.longitude, triggerPoint.latitude])

  const nearby = candidates.docs.filter((d) => {
    if (d.id === snap.id) return false
    const gh = d.data().locationGeohash as string | undefined
    if (!gh || !neighborPrefixes.has(gh.slice(0, 6))) return false
    const pt = ngeohash.decode(gh)
    const dist = turf.distance(turf.point([pt.longitude, pt.latitude]), triggerCoord, {
      units: 'meters',
    })
    return dist <= PROXIMITY_METERS
  })

  if (nearby.length === 0) return

  const existingClusterFromNearby = nearby.find((d) => d.data().duplicateClusterId)?.data()
    .duplicateClusterId as string | undefined
  const clusterId = existingCluster ?? existingClusterFromNearby ?? crypto.randomUUID()

  const toUpdate = nearby
    .filter((d) => d.data().duplicateClusterId !== clusterId)
    .slice(0, BATCH_CAP - 1)

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
    await duplicateClusterTriggerCore(adminDb, snap)
  },
)
