/**
 * hazard-signal-projector.ts
 *
 * Pure function that projects HazardSignalStatusDoc from a list of
 * HazardSignalDoc records. No side effects — safe to call from any context.
 * Firestore write helper (replayHazardSignalProjection) is the only I/O boundary.
 *
 * Priority rules per municipality:
 *   1. manual > scraper (manual override always wins)
 *   2. newer recordedAt > older
 *   3. higher signalLevel breaks remaining ties
 */

import type { Firestore } from 'firebase-admin/firestore'
import {
  CAMARINES_NORTE_MUNICIPALITIES,
  hazardSignalDocSchema,
  type HazardSignalDoc,
  type HazardSignalStatusDoc,
} from '@bantayog/shared-validators'

type SignalWithId = HazardSignalDoc & { id: string }

interface EffectiveScope {
  municipalityId: string
  signalLevel: 1 | 2 | 3 | 4 | 5
  source: 'manual' | 'scraper'
  signalId: string
}

/**
 * Compare two active signals for the same municipality.
 * Returns negative if `a` should win, positive if `b` should win.
 */
function compareSignals(a: SignalWithId, b: SignalWithId): number {
  // manual always beats scraper
  if (a.source !== b.source) return a.source === 'manual' ? -1 : 1
  // newer recordedAt wins
  if (a.recordedAt !== b.recordedAt) return b.recordedAt - a.recordedAt
  // higher level breaks tie
  return b.signalLevel - a.signalLevel
}

export function projectHazardSignalStatus(input: {
  now: number
  signals: SignalWithId[]
  scraperDegraded?: boolean
  degradedReasons?: string[]
}): HazardSignalStatusDoc {
  // Only signals whose status is 'active' AND whose validUntil is still in the future
  const eligible = input.signals.filter((s) => s.status === 'active' && s.validUntil > input.now)

  const effectiveScopes: EffectiveScope[] = []

  for (const { id: municipalityId } of CAMARINES_NORTE_MUNICIPALITIES) {
    const candidates = eligible
      .filter((s) => s.affectedMunicipalityIds.includes(municipalityId))
      .sort(compareSignals)

    const winner = candidates[0]
    if (!winner) continue

    effectiveScopes.push({
      municipalityId,
      signalLevel: winner.signalLevel as 1 | 2 | 3 | 4 | 5,
      source: winner.source,
      signalId: winner.id,
    })
  }

  const active = effectiveScopes.length > 0
  const levels = effectiveScopes.map((s) => s.signalLevel)
  const hasManual = effectiveScopes.some((s) => s.source === 'manual')

  const allMunicipalities = CAMARINES_NORTE_MUNICIPALITIES.length
  const coveredCount = effectiveScopes.length

  return {
    active,
    effectiveSignalId: active
      ? effectiveScopes.reduce(
          (max, s) => (s.signalLevel > max.signalLevel ? s : max),
          effectiveScopes[0],
        ).signalId
      : undefined,
    effectiveLevel: active ? Math.max(...levels) : undefined,
    effectiveSource: active ? (hasManual ? 'manual' : effectiveScopes[0]?.source) : undefined,
    scopeType:
      coveredCount === allMunicipalities ? 'province' : active ? 'municipalities' : undefined,
    affectedMunicipalityIds: effectiveScopes.map((s) => s.municipalityId),
    effectiveScopes,
    validUntil: active
      ? Math.min(
          ...effectiveScopes.map((scope) => {
            const sig = eligible.find((s) => s.id === scope.signalId)
            // sig is always present: effectiveScopes are built from eligible
            return sig?.validUntil ?? Infinity
          }),
        )
      : undefined,
    manualOverrideActive: hasManual,
    scraperDegraded: input.scraperDegraded ?? false,
    lastProjectedAt: input.now,
    degradedReasons: input.degradedReasons ?? [],
    schemaVersion: 1,
  }
}

/**
 * Reads all hazard_signals docs and writes the projected status to
 * hazard_signal_status/current. Intended for scheduled triggers and
 * on-demand replay.
 */
export async function replayHazardSignalProjection(input: {
  db: Firestore
  now: number
}): Promise<void> {
  const snap = await input.db.collection('hazard_signals').get()
  const signals: SignalWithId[] = snap.docs.flatMap((d) => {
    const parsed = hazardSignalDocSchema.safeParse(d.data())
    if (!parsed.success) {
      console.error('hazard_signals doc failed validation', d.id, parsed.error.issues)
      return []
    }
    return [{ id: d.id, ...parsed.data }]
  })
  const status: HazardSignalStatusDoc = projectHazardSignalStatus({ now: input.now, signals })
  await input.db.collection('hazard_signal_status').doc('current').set(status)
}
