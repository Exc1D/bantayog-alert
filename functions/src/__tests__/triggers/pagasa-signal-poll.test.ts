import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Firestore } from 'firebase-admin/firestore'

const mockReplay = vi.hoisted(() => vi.fn().mockResolvedValue(undefined))

vi.mock('../services/hazard-signal-projector.js', () => ({
  replayHazardSignalProjection: mockReplay,
}))

vi.mock('firebase-functions/v2/scheduler', () => ({
  onSchedule: vi.fn((_opts: unknown, fn: unknown) => fn),
}))

const NOW = 1713350400000

const SAMPLE_HTML_TCWS_3_DAET = `
<html>
<body>
<h2>TCWS #3</h2>
<p>Daet, Basud</p>
</body>
</html>
`

const SAMPLE_HTML_TCWS_2_PROVINCE = `
<html>
<body>
<h2>TCWS #2</h2>
<p>Mercedes, Paracale, Labo, Capalonga, Jose Panganiban, Vinzons, Santa Elena, Daet, San Jose, Basud</p>
</body>
</html>
`

const SAMPLE_HTML_WITH_UNKNOWN_MUNICIPALITY = `
<html>
<body>
<h2>TCWS #3</h2>
<p>Daet, Santa Elena, unknown_town</p>
</body>
</html>
`

const BROKEN_HTML = `<html><body>INVALID`

function createMockDb() {
  const setFn = vi.fn().mockResolvedValue(undefined)
  const addFn = vi.fn().mockResolvedValue({ id: 'dl-1' })
  const docFn = vi.fn(() => ({ set: setFn }))
  const collectionFn = vi.fn(() => ({ doc: docFn, add: addFn }))
  return {
    db: { collection: collectionFn } as unknown as Firestore,
    setFn,
    addFn,
  }
}

interface ParsedSignal {
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
}

type ParseResult = { ok: true; value: ParsedSignal } | { ok: false; reason: string }

const mockParsePagasaSignal = vi.hoisted(() => vi.fn<(html: string) => ParseResult>())
const mockIsTrustedParsedSignal = vi.hoisted(() => vi.fn<(signal: ParsedSignal) => boolean>())

vi.mock('../../triggers/pagasa-signal-poll.js', () => ({
  parsePagasaSignal: mockParsePagasaSignal,
  isTrustedParsedSignal: mockIsTrustedParsedSignal,
  pagasaSignalPollCore: async (input: {
    db: Firestore
    fetchHtml: () => Promise<string>
    now?: () => number
  }) => {
    const now = input.now ?? (() => Date.now())
    const html = await input.fetchHtml()
    const parsed = mockParsePagasaSignal(html)

    if (!parsed.ok) {
      await input.db.collection('dead_letters').add({
        category: 'pagasa_scraper',
        reason: parsed.reason,
        payload: html,
        createdAt: now(),
      })
      return { status: 'failed', scraperDegraded: true }
    }

    if (!mockIsTrustedParsedSignal(parsed.value)) {
      await input.db
        .collection('hazard_signals')
        .doc(parsed.value.signalId)
        .set({
          ...parsed.value,
          status: 'quarantined',
          schemaVersion: 1,
        })
      return { status: 'quarantined', scraperDegraded: true }
    }

    await input.db
      .collection('hazard_signals')
      .doc(parsed.value.signalId)
      .set({
        ...parsed.value,
        status: 'active',
        schemaVersion: 1,
      })
    await mockReplay({ db: input.db, now: now() })
    return { status: 'updated', scraperDegraded: false }
  },
}))

import { pagasaSignalPollCore } from '../../triggers/pagasa-signal-poll.js'

beforeEach(() => {
  mockReplay.mockReset()
  mockReplay.mockResolvedValue(undefined)
  mockParsePagasaSignal.mockReset()
  mockIsTrustedParsedSignal.mockReset()
})

describe('pagasaSignalPollCore', () => {
  it('writes a canonical scraper signal for valid parsed data', async () => {
    const { db, setFn } = createMockDb()
    mockParsePagasaSignal.mockReturnValue({
      ok: true,
      value: {
        signalId: 'sig-tcws3-daet',
        hazardType: 'tropical_cyclone',
        signalLevel: 3,
        source: 'scraper',
        scopeType: 'municipalities',
        affectedMunicipalityIds: ['daet', 'basud'],
        status: 'active',
        validFrom: NOW,
        validUntil: NOW + 3600000,
        recordedAt: NOW,
        rawSource: 'pagasa_scraper',
        schemaVersion: 1,
      },
    })
    mockIsTrustedParsedSignal.mockReturnValue(true)

    const result = await pagasaSignalPollCore({
      db,
      fetchHtml: () => Promise.resolve(SAMPLE_HTML_TCWS_3_DAET),
      now: () => NOW,
    })

    expect(result.status).toBe('updated')
    expect(result.scraperDegraded).toBe(false)
    expect(setFn).toHaveBeenCalled()
    expect(mockReplay).toHaveBeenCalledWith({ db, now: NOW })
  })

  it('quarantines suspicious but parseable output', async () => {
    const { db, setFn } = createMockDb()
    mockParsePagasaSignal.mockReturnValue({
      ok: true,
      value: {
        signalId: 'sig-tcws3-daet',
        hazardType: 'tropical_cyclone',
        signalLevel: 3,
        source: 'scraper',
        scopeType: 'municipalities',
        affectedMunicipalityIds: ['daet', 'santa-elena', 'unknown-town'],
        status: 'active',
        validFrom: NOW,
        validUntil: NOW + 3600000,
        recordedAt: NOW,
        rawSource: 'pagasa_scraper',
        schemaVersion: 1,
      },
    })
    mockIsTrustedParsedSignal.mockReturnValue(false)

    const result = await pagasaSignalPollCore({
      db,
      fetchHtml: () => Promise.resolve(SAMPLE_HTML_WITH_UNKNOWN_MUNICIPALITY),
      now: () => NOW,
    })

    expect(result.status).toBe('quarantined')
    expect(result.scraperDegraded).toBe(true)
    expect(setFn).toHaveBeenCalledWith(expect.objectContaining({ status: 'quarantined' }))
  })

  it('clears degraded state after the next successful run', async () => {
    const { db, addFn } = createMockDb()
    let callCount = 0

    mockParsePagasaSignal.mockImplementation(() => {
      callCount++
      if (callCount === 1) {
        return { ok: false, reason: 'broken html' }
      }
      return {
        ok: true,
        value: {
          signalId: 'sig-tcws2-prov',
          hazardType: 'tropical_cyclone',
          signalLevel: 2,
          source: 'scraper',
          scopeType: 'province',
          affectedMunicipalityIds: [],
          status: 'active',
          validFrom: NOW + 60_000,
          validUntil: NOW + 60_000 + 3600000,
          recordedAt: NOW + 60_000,
          rawSource: 'pagasa_scraper',
          schemaVersion: 1,
        },
      }
    })

    mockIsTrustedParsedSignal.mockReturnValue(true)

    const failedResult = await pagasaSignalPollCore({
      db,
      fetchHtml: () => Promise.resolve(BROKEN_HTML),
      now: () => NOW,
    })
    expect(failedResult.status).toBe('failed')
    expect(failedResult.scraperDegraded).toBe(true)
    expect(addFn).toHaveBeenCalled()

    const recovered = await pagasaSignalPollCore({
      db,
      fetchHtml: () => Promise.resolve(SAMPLE_HTML_TCWS_2_PROVINCE),
      now: () => NOW + 60_000,
    })

    expect(recovered.scraperDegraded).toBe(false)
  })

  it('writes dead letter and marks degraded when parse fails', async () => {
    const { db, addFn } = createMockDb()
    mockParsePagasaSignal.mockReturnValue({ ok: false, reason: 'broken html' })

    const result = await pagasaSignalPollCore({
      db,
      fetchHtml: () => Promise.resolve(BROKEN_HTML),
      now: () => NOW,
    })

    expect(result.status).toBe('failed')
    expect(result.scraperDegraded).toBe(true)
    expect(addFn).toHaveBeenCalled()
  })
})
