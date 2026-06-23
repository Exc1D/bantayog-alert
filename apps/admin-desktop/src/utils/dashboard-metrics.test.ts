import { describe, expect, it } from 'vitest'
import type { ResponderFleetMember } from '../hooks/useResponderFleet'
import type { Report } from '../types'
import { makeRow } from '../test-utils'
import {
  buildMunicipalData,
  getActiveDispatchCount,
  getAffectedMunicipalities,
  getUncoveredMunicipalityCount,
} from './dashboard-metrics'

function makeReport(overrides: Partial<Report> = {}): Report {
  return {
    id: 'report-1',
    type: 'flood',
    severity: 'medium',
    status: 'new',
    municipality: 'Daet',
    barangay: 'Barangay I',
    description: 'Test report',
    reporterName: 'Test Reporter',
    reporterPhone: '09170000000',
    latitude: 14.1122,
    longitude: 122.9553,
    createdAt: '2026-06-23T00:00:00.000Z',
    updatedAt: '2026-06-23T00:00:00.000Z',
    ...overrides,
  }
}

function makeResponder(overrides: Partial<ResponderFleetMember> = {}): ResponderFleetMember {
  return {
    uid: 'responder-1',
    displayName: 'Responder One',
    availabilityStatus: 'available',
    lastActivityAt: Date.now(),
    onlineStatus: 'online',
    ...overrides,
  }
}

describe('dashboard metrics', () => {
  it('counts only non-terminal dispatch lifecycle states as active', () => {
    const activeStatuses = [
      'pending',
      'accepted',
      'acknowledged',
      'en_route',
      'on_scene',
      'escalated',
    ]
    const terminalStatuses = [
      'resolved',
      'declined',
      'timed_out',
      'cancelled',
      'superseded',
      'unable_to_complete',
      'needs_admin',
    ]

    const rows = [...activeStatuses, ...terminalStatuses].map((status, index) =>
      makeRow({ dispatchId: `dispatch-${String(index)}`, status }),
    )

    expect(getActiveDispatchCount(rows)).toBe(activeStatuses.length)
  })

  it('populates available responder coverage by normalized municipality', () => {
    const municipalData = buildMunicipalData(
      [
        makeReport({ id: 'daet-active', municipality: 'Daet', status: 'new' }),
        makeReport({ id: 'daet-closed', municipality: 'Daet', status: 'closed' }),
        makeReport({ id: 'mercedes-active', municipality: 'Mercedes', status: 'verified' }),
      ],
      [
        makeResponder({ uid: 'daet-1', municipalityId: 'daet' }),
        makeResponder({ uid: 'daet-2', municipalityId: ' DAET ' }),
        makeResponder({ uid: 'unscoped' }),
      ],
    )

    expect(municipalData).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          municipality: 'Daet',
          activeIncidents: 1,
          activeResponders: 2,
        }),
        expect.objectContaining({
          municipality: 'Mercedes',
          activeIncidents: 1,
          activeResponders: 0,
        }),
      ]),
    )
    expect(getAffectedMunicipalities(municipalData)).toEqual(['Daet', 'Mercedes'])
    expect(getUncoveredMunicipalityCount(municipalData)).toBe(1)
  })

  it('does not call a municipality uncovered when it has no active incident', () => {
    const municipalData = buildMunicipalData(
      [
        makeReport({ id: 'basud-closed', municipality: 'Basud', status: 'closed' }),
        makeReport({ id: 'daet-active', municipality: 'Daet', status: 'new' }),
      ],
      [makeResponder({ municipalityId: 'Daet' })],
    )

    expect(getUncoveredMunicipalityCount(municipalData)).toBe(0)
  })
})
