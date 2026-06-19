import { describe, expect, it } from 'vitest'
import { BantayogError, BantayogErrorCode } from '@bantayog/shared-validators'

import {
  assertRedispatchResponderData,
  assertRedispatchTerminalStatus,
  assertReportInActorMunicipality,
  assertResponderInReportMunicipality,
  assertVerifiedReportStatus,
  buildRedispatchDispatchData,
  getActorMunicipalityIds,
  getRedispatchDeadlineMs,
} from '../redispatch-policy.js'

describe('redispatch policy', () => {
  it('accepts terminal dispatch states and rejects non-terminal states', () => {
    expect(() => {
      assertRedispatchTerminalStatus('declined')
    }).not.toThrow()
    expect(() => {
      assertRedispatchTerminalStatus('timed_out')
    }).not.toThrow()
    expect(() => {
      assertRedispatchTerminalStatus('cancelled')
    }).not.toThrow()

    expect(() => {
      assertRedispatchTerminalStatus('pending')
    }).toThrow(BantayogError)
    try {
      assertRedispatchTerminalStatus('pending')
    } catch (err) {
      expect(err).toBeInstanceOf(BantayogError)
      expect((err as BantayogError).code).toBe(BantayogErrorCode.FAILED_PRECONDITION)
      expect((err as BantayogError).message).toContain('Cannot redispatch from status pending')
    }
  })

  it('derives actor municipality ids from both claim eras', () => {
    expect(
      getActorMunicipalityIds({
        municipalityId: 'daet',
        permittedMunicipalityIds: ['basud', 'mercedes'],
      }),
    ).toEqual(['daet', 'basud', 'mercedes'])
  })

  it('rejects invalid report municipality ids before scope comparison', () => {
    const invalidValues: unknown[] = [null, undefined, '', 123]

    for (const reportMunicipalityId of invalidValues) {
      try {
        assertReportInActorMunicipality(['daet'], reportMunicipalityId)
      } catch (err) {
        expect(err).toBeInstanceOf(BantayogError)
        expect((err as BantayogError).code).toBe(BantayogErrorCode.INVALID_ARGUMENT)
        expect((err as BantayogError).message).toContain('Report missing municipalityId')
      }
    }
  })

  it('rejects reports and responders outside the permitted redispatch scope', () => {
    expect(() => {
      assertReportInActorMunicipality(['daet'], 'basud')
    }).toThrow(BantayogError)
    expect(() => {
      assertVerifiedReportStatus('new')
    }).toThrow(BantayogError)
    expect(() => {
      assertRedispatchResponderData({ agencyId: 'bfp', municipalityId: 'daet', isActive: false })
    }).toThrow(BantayogError)
    expect(() => {
      assertResponderInReportMunicipality('basud', 'daet')
    }).toThrow(BantayogError)
  })

  it('uses severity deadlines and falls back to medium for invalid severity', () => {
    expect(getRedispatchDeadlineMs('critical')).toBe(5 * 60 * 1000)
    expect(getRedispatchDeadlineMs('high')).toBe(5 * 60 * 1000)
    expect(getRedispatchDeadlineMs('low')).toBe(30 * 60 * 1000)
    expect(getRedispatchDeadlineMs('unknown')).toBe(15 * 60 * 1000)
  })

  it('builds the new dispatch document without undefined optionals', () => {
    const dispatch = buildRedispatchDispatchData({
      newDispatchId: 'report-1_responder-2',
      reportId: 'report-1',
      newResponderUid: 'responder-2',
      responderAgencyId: 'mdrrmo',
      responderMunicipalityId: 'daet',
      actorUid: 'admin-1',
      nowMillis: 1713350400000,
      deadlineMs: 5 * 60 * 1000,
      correlationId: 'corr-1',
    })

    expect(dispatch).toEqual({
      dispatchId: 'report-1_responder-2',
      reportId: 'report-1',
      status: 'pending',
      assignedTo: {
        uid: 'responder-2',
        agencyId: 'mdrrmo',
        municipalityId: 'daet',
      },
      dispatchedAt: 1713350400000,
      dispatchedBy: 'admin-1',
      lastStatusAt: 1713350400000,
      acknowledgementDeadlineAt: 1713350700000,
      correlationId: 'corr-1',
      schemaVersion: 1,
    })
    expect(Object.values(dispatch)).not.toContain(undefined)
  })
})
