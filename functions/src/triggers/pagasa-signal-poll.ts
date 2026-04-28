import type { Firestore } from 'firebase-admin/firestore'
import { replayHazardSignalProjection } from '../services/hazard-signal-projector.js'

export async function upsertScraperSignal(
  db: Firestore,
  signal: {
    signalId: string
    hazardType: 'tropical_cyclone'
    signalLevel: number
    source: 'scraper'
    scopeType: 'municipalities' | 'province'
    affectedMunicipalityIds: string[]
    status: 'active'
    validFrom: number
    validUntil: number
    recordedAt: number
    rawSource: string
    schemaVersion: number
  },
  _now: number,
): Promise<void> {
  void _now
  const payload = {
    ...signal,
    schemaVersion: 1,
  }
  await db.collection('hazard_signals').doc(signal.signalId).set(payload)
}

export async function writeSignalDeadLetter(
  db: Firestore,
  category: string,
  reason: string,
  payload: unknown,
  _now: number,
): Promise<void> {
  void _now
  await db.collection('dead_letters').add({
    category,
    reason,
    payload,
    createdAt: Date.now(),
  })
}

export async function markScraperDegraded(
  db: Firestore,
  now: number,
  reason: string,
): Promise<void> {
  const existing = await db.collection('hazard_signal_status').doc('current').get()
  const existingData = existing.data() ?? {}
  const existingReasons: string[] = Array.isArray(existingData.degradedReasons)
    ? existingData.degradedReasons
    : []

  await db
    .collection('hazard_signal_status')
    .doc('current')
    .set(
      {
        scraperDegraded: true,
        degradedReasons: [...new Set([...existingReasons, reason])],
        lastProjectedAt: now,
      },
      { merge: true },
    )
}

export async function clearScraperDegraded(db: Firestore, now: number): Promise<void> {
  await db
    .collection('hazard_signal_status')
    .doc('current')
    .set(
      {
        scraperDegraded: false,
        degradedReasons: [] as string[],
        lastProjectedAt: now,
      },
      { merge: true },
    )
}

export type ParseResult =
  | { ok: true; value: { signalId: string; [key: string]: unknown } }
  | { ok: false; reason: string }

export function parsePagasaSignal(html: string): ParseResult {
  const tcwsMatch = /TCWS\s*#?(\d+)/i.exec(html)
  if (!tcwsMatch) {
    return { ok: false, reason: 'no_tcws_signal_found' }
  }

  const levelStr = tcwsMatch[1]
  if (!levelStr) {
    return { ok: false, reason: 'invalid_signal_level' }
  }
  const signalLevel = parseInt(levelStr, 10)
  if (isNaN(signalLevel) || signalLevel < 1 || signalLevel > 5) {
    return { ok: false, reason: 'invalid_signal_level' }
  }

  const municipalityIds: string[] = []
  const municipalityPatterns = [
    'Daet',
    'San Jose',
    'Basud',
    'Camarines Norte',
    'Mercedes',
    'Paracale',
    'Labo',
    'Capalonga',
    'Jose Panganiban',
    'Vinzons',
    'Santa Elena',
  ]

  for (const pattern of municipalityPatterns) {
    if (html.includes(pattern)) {
      const id = pattern.toLowerCase().replace(/\s+/g, '-')
      if (!municipalityIds.includes(id)) {
        municipalityIds.push(id)
      }
    }
  }

  if (municipalityIds.length === 0) {
    return { ok: false, reason: 'no_municipality_found' }
  }

  const firstId = municipalityIds[0]
  const signalId = `sig-tcws${String(signalLevel)}-${String(firstId)}`

  return {
    ok: true,
    value: {
      signalId,
      hazardType: 'tropical_cyclone',
      signalLevel,
      source: 'scraper' as const,
      scopeType: municipalityIds.length >= 11 ? ('province' as const) : ('municipalities' as const),
      affectedMunicipalityIds: municipalityIds,
      status: 'active' as const,
      validFrom: Date.now(),
      validUntil: Date.now() + 3600000,
      recordedAt: Date.now(),
      rawSource: 'pagasa_scraper',
      schemaVersion: 1,
    },
  }
}

export function isTrustedParsedSignal(signal: Record<string, unknown>): boolean {
  const KNOWN_MUNICIPALITIES = new Set([
    'daet',
    'san-jose',
    'basud',
    'mercedes',
    'paracale',
    'labo',
    'capalonga',
    'jose-panganiban',
    'vinzons',
    'santa-elena',
  ])

  const affected = signal.affectedMunicipalityIds as string[]
  if (!Array.isArray(affected)) return false

  for (const m of affected) {
    if (!KNOWN_MUNICIPALITIES.has(m)) {
      return false
    }
  }

  return true
}

export interface PagasaSignalPollResult {
  status: 'updated' | 'quarantined' | 'failed'
  scraperDegraded: boolean
}

export async function pagasaSignalPollCore(input: {
  db: Firestore
  fetchHtml: () => Promise<string>
  now?: () => number
}): Promise<PagasaSignalPollResult> {
  const now = input.now ?? (() => Date.now())

  try {
    const html = await input.fetchHtml()
    const parsed = parsePagasaSignal(html)

    if (!parsed.ok) {
      await writeSignalDeadLetter(input.db, 'pagasa_scraper', parsed.reason, html, now())
      await markScraperDegraded(input.db, now(), 'parse_failed')
      return { status: 'failed', scraperDegraded: true }
    }

    if (!isTrustedParsedSignal(parsed.value)) {
      await input.db
        .collection('hazard_signals')
        .doc(parsed.value.signalId)
        .set({
          ...parsed.value,
          status: 'quarantined',
          schemaVersion: 1,
        })
      await markScraperDegraded(input.db, now(), 'quarantined_output')
      return { status: 'quarantined', scraperDegraded: true }
    }

    await upsertScraperSignal(
      input.db,
      parsed.value as {
        signalId: string
        hazardType: 'tropical_cyclone'
        signalLevel: number
        source: 'scraper'
        scopeType: 'municipalities' | 'province'
        affectedMunicipalityIds: string[]
        status: 'active'
        validFrom: number
        validUntil: number
        recordedAt: number
        rawSource: string
        schemaVersion: number
      },
      now(),
    )
    await clearScraperDegraded(input.db, now())
    await replayHazardSignalProjection({ db: input.db, now: now() })
    return { status: 'updated', scraperDegraded: false }
  } catch (err) {
    await writeSignalDeadLetter(input.db, 'pagasa_scraper', String(err), {}, now())
    await markScraperDegraded(input.db, now(), 'fetch_failed')
    return { status: 'failed', scraperDegraded: true }
  }
}
