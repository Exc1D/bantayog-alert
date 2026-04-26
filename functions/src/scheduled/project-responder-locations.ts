import { onSchedule } from 'firebase-functions/v2/scheduler'
import type { Database } from 'firebase-admin/database'
import { rtdb } from '../admin-init.js'
import { logDimension } from '@bantayog/shared-validators'

const log = logDimension('projectResponderLocations')

const GRID_PRECISION = 3 // 0.001 degrees ≈ 111m
const FRESH_MS = 30_000
const DEGRADED_MS = 90_000
const STALE_MS = 300_000
const TTL_MS = 90_000

export type Freshness = 'fresh' | 'degraded' | 'stale' | 'offline'

export interface ProjectionEntry {
  lat: number
  lng: number
  freshness: Freshness
  lastSeenAt: number
}

export function roundToGrid(value: number): number {
  return Number(value.toFixed(GRID_PRECISION))
}

export function computeFreshness(telemetryAgeMs: number): Freshness {
  if (telemetryAgeMs < FRESH_MS) return 'fresh'
  if (telemetryAgeMs < DEGRADED_MS) return 'degraded'
  if (telemetryAgeMs < STALE_MS) return 'stale'
  return 'offline'
}

export interface ProjectResponderLocationsDeps {
  now: number
}

export async function projectResponderLocationsCore(
  database: Database,
  deps: ProjectResponderLocationsDeps,
): Promise<void> {
  const now = deps.now

  const [locationsSnap, indexSnap] = await Promise.all([
    database.ref('responder_locations').get(),
    database.ref('responder_index').get(),
  ])

  const locations = (locationsSnap.val() ?? {}) as Record<
    string,
    { capturedAt?: number; lat?: number; lng?: number }
  >
  const index = (indexSnap.val() ?? {}) as Record<string, { municipalityId?: string }>

  const byMunicipality: Record<string, Record<string, ProjectionEntry>> = {}
  const offlineUids: { municipalityId: string; uid: string }[] = []

  for (const [uid, loc] of Object.entries(locations)) {
    if (
      typeof loc.capturedAt !== 'number' ||
      typeof loc.lat !== 'number' ||
      typeof loc.lng !== 'number'
    ) {
      continue
    }

    const telemetryAgeMs = now - loc.capturedAt
    const freshness = computeFreshness(telemetryAgeMs)
    const muniId = index[uid]?.municipalityId

    if (freshness === 'offline') {
      if (muniId) {
        offlineUids.push({ municipalityId: muniId, uid })
      }
      continue
    }

    if (!muniId) {
      log({
        severity: 'WARNING',
        code: 'projection.missing_municipality',
        message: `No municipalityId found for responder ${uid}`,
      })
      continue
    }

    byMunicipality[muniId] ??= {}

    const telemetryTs = typeof loc.capturedAt === 'number' ? loc.capturedAt : now

    byMunicipality[muniId][uid] = {
      lat: roundToGrid(loc.lat),
      lng: roundToGrid(loc.lng),
      freshness,
      lastSeenAt: telemetryTs,
    }
  }

  const writeOps: Promise<unknown>[] = []

  // Write/update projection entries
  for (const [muniId, entries] of Object.entries(byMunicipality)) {
    for (const [uid, entry] of Object.entries(entries)) {
      writeOps.push(database.ref(`shared_projection/${muniId}/${uid}`).set(entry))
    }
  }

  // Delete offline responders from projection
  for (const { municipalityId, uid } of offlineUids) {
    writeOps.push(database.ref(`shared_projection/${municipalityId}/${uid}`).remove())
  }

  // TTL cleanup: delete projection entries not updated in 90s
  const projectionSnap = await database.ref('shared_projection').get()
  const projections = (projectionSnap.val() ?? {}) as Record<
    string,
    Record<string, ProjectionEntry>
  >

  for (const [muniId, entries] of Object.entries(projections)) {
    for (const [uid, entry] of Object.entries(entries)) {
      if (typeof entry.lastSeenAt === 'number' && now - entry.lastSeenAt > TTL_MS) {
        writeOps.push(database.ref(`shared_projection/${muniId}/${uid}`).remove())
      }
    }
  }

  await Promise.all(writeOps)
}

export const projectResponderLocations = onSchedule(
  { schedule: 'every 30 seconds', region: 'asia-southeast1', timeoutSeconds: 60 },
  async () => {
    try {
      await projectResponderLocationsCore(rtdb, { now: Date.now() })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      log({
        severity: 'ERROR',
        code: 'projection.failed',
        message: `Responder location projection failed: ${message}`,
        data: { error: message },
      })
      throw err
    }
  },
)
