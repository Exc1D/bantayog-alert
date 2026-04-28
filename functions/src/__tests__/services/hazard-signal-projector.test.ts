import { describe, it, expect } from 'vitest'
import type { HazardSignalDoc, HazardSignalStatusDoc } from '@bantayog/shared-validators'
import { projectHazardSignalStatus } from '../../services/hazard-signal-projector.js'

const NOW = 1713350400000

type SignalStatus = 'active' | 'cleared' | 'expired' | 'superseded' | 'quarantined'

function manualSignal(overrides: {
  id: string
  affectedMunicipalityIds: string[]
  signalLevel?: number
  status?: SignalStatus
  validUntil?: number
}): HazardSignalDoc & { id: string } {
  return {
    id: overrides.id,
    hazardType: 'tropical_cyclone',
    signalLevel: overrides.signalLevel ?? 3,
    source: 'manual',
    scopeType: 'municipalities',
    affectedMunicipalityIds: overrides.affectedMunicipalityIds,
    status: overrides.status ?? 'active',
    validFrom: NOW - 3600000,
    validUntil: overrides.validUntil ?? NOW + 3600000,
    recordedAt: NOW - 1000,
    rawSource: 'manual_superadmin',
    recordedBy: 'super-1',
    schemaVersion: 1,
  }
}

function scraperSignal(overrides: {
  id: string
  affectedMunicipalityIds: string[]
  signalLevel?: number
  status?: SignalStatus
  validUntil?: number
}): HazardSignalDoc & { id: string } {
  return {
    id: overrides.id,
    hazardType: 'tropical_cyclone',
    signalLevel: overrides.signalLevel ?? 3,
    source: 'scraper',
    scopeType: 'municipalities',
    affectedMunicipalityIds: overrides.affectedMunicipalityIds,
    status: overrides.status ?? 'active',
    validFrom: NOW - 3600000,
    validUntil: overrides.validUntil ?? NOW + 3600000,
    recordedAt: NOW - 2000,
    rawSource: 'pagasa_scraper',
    schemaVersion: 1,
  }
}

describe('projectHazardSignalStatus', () => {
  it('prefers manual signals per municipality regardless of higher scraper level', () => {
    const result: HazardSignalStatusDoc = projectHazardSignalStatus({
      now: NOW,
      signals: [
        manualSignal({ id: 'm-1', affectedMunicipalityIds: ['daet'], signalLevel: 3 }),
        scraperSignal({ id: 's-1', affectedMunicipalityIds: ['daet'], signalLevel: 4 }),
      ],
    })

    expect(result.effectiveScopes).toEqual([
      { municipalityId: 'daet', signalLevel: 3, source: 'manual', signalId: 'm-1' },
    ])
    expect(result.effectiveLevel).toBe(3)
    expect(result.manualOverrideActive).toBe(true)
  })

  it('does not revive a superseded manual signal after the newer one expires', () => {
    const result: HazardSignalStatusDoc = projectHazardSignalStatus({
      now: NOW,
      signals: [
        manualSignal({
          id: 'm-1',
          affectedMunicipalityIds: ['daet'],
          signalLevel: 3,
          status: 'superseded',
        }),
        manualSignal({
          id: 'm-2',
          affectedMunicipalityIds: ['daet'],
          signalLevel: 4,
          status: 'expired',
        }),
      ],
    })

    expect(result.effectiveScopes).toEqual([])
    expect(result.active).toBe(false)
  })

  it('validUntil reflects the winning signal expiry, not a losing signals expiry', () => {
    const result = projectHazardSignalStatus({
      now: NOW,
      signals: [
        // Manual wins for daet; expires late
        manualSignal({
          id: 'm-1',
          affectedMunicipalityIds: ['daet'],
          signalLevel: 3,
          validUntil: NOW + 7200000,
        }),
        // Scraper loses for daet; expires soon — must NOT drag validUntil down
        scraperSignal({
          id: 's-1',
          affectedMunicipalityIds: ['daet'],
          signalLevel: 4,
          validUntil: NOW + 60000,
        }),
      ],
    })

    expect(result.active).toBe(true)
    expect(result.validUntil).toBe(NOW + 7200000)
  })

  it('marks inactive when the only scraper signal is expired', () => {
    const result: HazardSignalStatusDoc = projectHazardSignalStatus({
      now: NOW,
      signals: [
        scraperSignal({ id: 's-1', affectedMunicipalityIds: ['daet'], validUntil: NOW - 1 }),
      ],
    })

    expect(result.active).toBe(false)
  })

  it('validUntil is the minimum across all municipality winners', () => {
    const result = projectHazardSignalStatus({
      now: NOW,
      signals: [
        manualSignal({
          id: 'm-daet',
          affectedMunicipalityIds: ['daet'],
          validUntil: NOW + 7200000,
        }),
        manualSignal({
          id: 'm-basud',
          affectedMunicipalityIds: ['basud'],
          validUntil: NOW + 3600000,
        }),
      ],
    })
    expect(result.active).toBe(true)
    expect(result.validUntil).toBe(NOW + 3600000)
  })

  it('newer recordedAt wins tie-break when sources match', () => {
    const result = projectHazardSignalStatus({
      now: NOW,
      signals: [
        // both scrapers for same municipality; s-newer has higher recordedAt
        {
          ...scraperSignal({ id: 's-older', affectedMunicipalityIds: ['daet'] }),
          recordedAt: NOW - 5000,
        },
        {
          ...scraperSignal({ id: 's-newer', affectedMunicipalityIds: ['daet'] }),
          recordedAt: NOW - 1000,
        },
      ],
    })
    expect(result.effectiveScopes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ municipalityId: 'daet', signalId: 's-newer' }),
      ]),
    )
  })
})
