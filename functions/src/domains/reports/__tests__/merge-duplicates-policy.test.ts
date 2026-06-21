import { describe, expect, it } from 'vitest'

import {
  buildMergeDuplicateReportUpdate,
  buildMergeEventData,
  buildPrimaryMergeReportUpdate,
  excludesPrimaryReportId,
  hasUniqueDuplicateReportIds,
  validateMergeActorClaims,
  validateMergeOpsRows,
} from '../merge-duplicates-policy.js'

describe('merge duplicates policy', () => {
  it('validates duplicate report id sets', () => {
    expect(hasUniqueDuplicateReportIds(['r2', 'r3'])).toBe(true)
    expect(hasUniqueDuplicateReportIds(['r2', 'r2'])).toBe(false)
    expect(excludesPrimaryReportId('r1', ['r2', 'r3'])).toBe(true)
    expect(excludesPrimaryReportId('r1', ['r1'])).toBe(false)
  })

  it('rejects merge actors by role or inactive status', () => {
    expect(validateMergeActorClaims({ role: 'citizen', active: true })).toEqual({
      success: false,
      errorCode: 'permission-denied',
      reason: 'role',
    })

    expect(validateMergeActorClaims({ role: 'municipal_admin', active: false })).toEqual({
      success: false,
      errorCode: 'permission-denied',
      reason: 'inactive',
    })
  })

  it('rejects invalid merge ops rows with stable error codes', () => {
    expect(
      validateMergeOpsRows(
        [
          { id: 'r1', municipalityId: 'daet', duplicateClusterId: 'cluster-1' },
          { id: 'r2', duplicateClusterId: 'cluster-1' },
        ],
        { role: 'municipal_admin', municipalityId: 'daet' },
      ),
    ).toEqual({ success: false, errorCode: 'failed-precondition' })

    expect(
      validateMergeOpsRows(
        [
          { id: 'r1', municipalityId: 'daet', duplicateClusterId: 'cluster-1' },
          { id: 'r2', municipalityId: 'basud', duplicateClusterId: 'cluster-1' },
        ],
        { role: 'municipal_admin', municipalityId: 'daet' },
      ),
    ).toEqual({ success: false, errorCode: 'invalid-argument' })

    expect(
      validateMergeOpsRows(
        [
          { id: 'r1', municipalityId: 'daet', duplicateClusterId: 'cluster-1' },
          { id: 'r2', municipalityId: 'daet', duplicateClusterId: 'cluster-2' },
        ],
        { role: 'municipal_admin', municipalityId: 'daet' },
      ),
    ).toEqual({ success: false, errorCode: 'failed-precondition' })

    expect(
      validateMergeOpsRows(
        [
          { id: 'r1', municipalityId: 'daet', duplicateClusterId: 'cluster-1' },
          { id: 'r2', municipalityId: 'daet', duplicateClusterId: 'cluster-1' },
        ],
        { role: 'municipal_admin', municipalityId: 'basud' },
      ),
    ).toEqual({ success: false, errorCode: 'permission-denied' })

    expect(
      validateMergeOpsRows(
        [
          { id: 'r1', municipalityId: ' ', duplicateClusterId: 'cluster-1' },
          { id: 'r2', municipalityId: ' ', duplicateClusterId: 'cluster-1' },
        ],
        { role: 'provincial_superadmin' },
      ),
    ).toEqual({ success: false, errorCode: 'failed-precondition' })

    expect(
      validateMergeOpsRows(
        [
          { id: 'r1', municipalityId: 'daet', duplicateClusterId: ' ' },
          { id: 'r2', municipalityId: 'daet', duplicateClusterId: ' ' },
        ],
        { role: 'provincial_superadmin' },
      ),
    ).toEqual({ success: false, errorCode: 'failed-precondition' })

    for (const malformedRow of [
      { id: 'r1', municipalityId: 7, duplicateClusterId: 'cluster-1' },
      { id: 'r1', municipalityId: 'daet', duplicateClusterId: 7 },
    ]) {
      expect(
        validateMergeOpsRows([malformedRow], {
          role: 'provincial_superadmin',
        }),
      ).toEqual({ success: false, errorCode: 'failed-precondition' })
    }
  })

  it('reconciles survivor media and loser terminal updates without undefined fields', () => {
    const primaryUpdate = buildPrimaryMergeReportUpdate('r1', [
      { id: 'r1', mediaRefs: ['media-a', 7, 'media-b'] },
      { id: 'r2', mediaRefs: ['media-b', 'media-c'] },
      { id: 'r3', mediaRefs: 'not-an-array' },
    ])

    expect(primaryUpdate).toEqual({ mediaRefs: ['media-a', 'media-b', 'media-c'] })
    expect(buildMergeDuplicateReportUpdate('r1')).toEqual({
      status: 'merged_as_duplicate',
      mergedInto: 'r1',
    })
    expect(Object.values(primaryUpdate)).not.toContain(undefined)
  })

  it('builds the report event payload shape', () => {
    expect(
      buildMergeEventData({
        eventId: 'event-1',
        primaryReportId: 'r1',
        actorUid: 'admin-1',
        actorRole: 'municipal_admin',
        at: 1713350400000,
        correlationId: 'corr-1',
        duplicateReportIds: ['r2', 'r3'],
      }),
    ).toEqual({
      eventId: 'event-1',
      reportId: 'r1',
      eventType: 'merge_duplicates',
      actor: 'admin-1',
      actorRole: 'municipal_admin',
      at: 1713350400000,
      correlationId: 'corr-1',
      schemaVersion: 1,
      mergedCount: 2,
      mergedDuplicateIds: ['r2', 'r3'],
    })
  })
})
