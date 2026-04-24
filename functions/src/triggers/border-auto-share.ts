import { onDocumentCreated } from 'firebase-functions/v2/firestore'
import * as turf from '@turf/turf'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import type { FeatureCollection, Feature, Polygon } from 'geojson'
import { adminDb } from '../admin-init.js'
import { logDimension } from '@bantayog/shared-validators'

const log = logDimension('borderAutoShare')

// Load once per function instance — not per invocation
let municipalityBoundaries: FeatureCollection | null = null
function getMunicipalityBoundaries(): FeatureCollection {
  if (!municipalityBoundaries) {
    const require = createRequire(import.meta.url)
    const filePath = require.resolve('@bantayog/shared-data/municipality-boundaries.geojson')
    municipalityBoundaries = JSON.parse(readFileSync(filePath, 'utf8')) as FeatureCollection
  }
  return municipalityBoundaries
}

export interface BorderAutoShareDeps {
  reportId: string
  opsData: Record<string, unknown>
  boundaryGeohashSet: ReadonlySet<string>
}

export async function borderAutoShareCore(
  db: FirebaseFirestore.Firestore,
  deps: BorderAutoShareDeps,
): Promise<void> {
  const { reportId, opsData, boundaryGeohashSet } = deps
  const locationGeohash = opsData.locationGeohash as string | undefined
  if (!locationGeohash) return

  if (!boundaryGeohashSet.has(locationGeohash)) return

  // Load exact location from report_private
  const privateSnap = await db.collection('report_private').doc(reportId).get()
  const exactLocation = privateSnap.data()?.exactLocation as
    | { lat: number; lng: number }
    | undefined
  if (!exactLocation) return

  const point = turf.point([exactLocation.lng, exactLocation.lat])
  const boundaries = getMunicipalityBoundaries()
  const ownerMuniId = opsData.municipalityId as string

  // Get current sharing state to avoid re-sharing
  const existingSnap = await db.collection('report_sharing').doc(reportId).get()
  const existingData = existingSnap.data()
  const alreadySharedWith = (existingData?.sharedWith as string[] | undefined) ?? []

  const nowMs = Date.now()
  for (const feature of boundaries.features) {
    const targetMuniId = feature.properties?.municipalityId as string
    if (targetMuniId === ownerMuniId) continue
    if (alreadySharedWith.includes(targetMuniId)) continue

    const buffered = turf.buffer(feature as Feature<Polygon>, 0.5, {
      units: 'kilometers',
    })
    if (!buffered || !turf.booleanPointInPolygon(point, buffered)) continue

    // This report is within 500m of targetMuniId's boundary — auto-share
    const sharingRef = db.collection('report_sharing').doc(reportId)
    const eventRef = sharingRef.collection('events').doc()
    const threadRef = db.collection('command_channel_threads').doc()
    const opsRef = db.collection('report_ops').doc(reportId)

    // eslint-disable-next-line @typescript-eslint/require-await
    await db.runTransaction(async (tx) => {
      tx.set(
        sharingRef,
        {
          ownerMunicipalityId: ownerMuniId,
          reportId,
          sharedWith: [...new Set([...alreadySharedWith, targetMuniId])],
          updatedAt: nowMs,
          schemaVersion: 1,
        },
        { merge: true },
      )
      tx.set(eventRef, {
        targetMunicipalityId: targetMuniId,
        sharedBy: 'system',
        sharedAt: nowMs,
        source: 'auto',
        schemaVersion: 1,
      })
      tx.set(threadRef, {
        threadId: threadRef.id,
        reportId,
        threadType: 'border_share',
        subject: `Auto-shared with ${targetMuniId} (boundary proximity)`,
        participantUids: {},
        createdBy: 'system',
        createdAt: nowMs,
        updatedAt: nowMs,
        schemaVersion: 1,
      })
      tx.update(opsRef, {
        'visibility.scope': 'shared',
        'visibility.sharedWith': [...new Set([...alreadySharedWith, targetMuniId])],
        updatedAt: nowMs,
      })
    })
    log({
      severity: 'INFO',
      code: 'border.auto-share',
      message: `Auto-shared ${reportId} with ${targetMuniId}`,
    })
  }
}

export const borderAutoShareTrigger = onDocumentCreated(
  { document: 'report_ops/{reportId}', region: 'asia-southeast1', timeoutSeconds: 60 },
  async (event) => {
    const opsData = event.data?.data() ?? {}
    let boundaryGeohashSet: ReadonlySet<string> = new Set()
    try {
      const mod = (await import('@bantayog/shared-data')) as {
        BOUNDARY_GEOHASH_SET?: ReadonlySet<string>
      }
      boundaryGeohashSet = mod.BOUNDARY_GEOHASH_SET ?? new Set()
    } catch {
      // shared-data not configured yet — skip auto-sharing
    }
    await borderAutoShareCore(adminDb, {
      reportId: event.params.reportId,
      opsData,
      boundaryGeohashSet,
    })
  },
)
