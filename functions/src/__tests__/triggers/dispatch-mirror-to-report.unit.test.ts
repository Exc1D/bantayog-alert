import { describe, expect, it } from 'vitest'
import { computeMirrorAction } from '../../triggers/dispatch-mirror-to-report.js'
import type { DispatchStatus } from '@bantayog/shared-validators'

describe('computeMirrorAction', () => {
  // --- skip: before === after ---
  it('skip when before === after (accepted→accepted)', () => {
    expect(computeMirrorAction('accepted', 'accepted', 'acknowledged')).toEqual({
      action: 'skip',
      reason: 'noop_same_status',
    })
  })

  it('skip when before === after (en_route→en_route)', () => {
    expect(computeMirrorAction('en_route', 'en_route', 'en_route')).toEqual({
      action: 'skip',
      reason: 'noop_same_status',
    })
  })

  // --- skip: after is cancelled ---
  it('skip when after is cancelled', () => {
    expect(computeMirrorAction('accepted', 'cancelled', 'acknowledged')).toEqual({
      action: 'skip',
      reason: 'cancel_owned_by_callable',
    })
  })

  it('skip when after is cancelled (from pending)', () => {
    expect(computeMirrorAction('pending', 'cancelled', 'assigned')).toEqual({
      action: 'skip',
      reason: 'cancel_owned_by_callable',
    })
  })

  // --- skip: dispatchToReportState returns null ---
  it('skip when dispatchToReportState(after) is null — declined', () => {
    expect(computeMirrorAction('pending', 'declined', 'assigned')).toEqual({
      action: 'skip',
      reason: 'no_mirror_for_declined',
    })
  })

  it('skip when dispatchToReportState(after) is null — timed_out', () => {
    expect(computeMirrorAction('pending', 'timed_out', 'assigned')).toEqual({
      action: 'skip',
      reason: 'no_mirror_for_timed_out',
    })
  })

  it('skip when dispatchToReportState(after) is null — superseded', () => {
    expect(computeMirrorAction('pending', 'superseded', 'assigned')).toEqual({
      action: 'skip',
      reason: 'no_mirror_for_superseded',
    })
  })

  it('skip when dispatchToReportState(after) is null — pending', () => {
    expect(computeMirrorAction(undefined, 'pending', 'verified')).toEqual({
      action: 'skip',
      reason: 'no_mirror_for_pending',
    })
  })

  // --- skip: already at target ---
  it('skip when mapped status equals currentReportStatus', () => {
    expect(computeMirrorAction('accepted', 'acknowledged', 'acknowledged')).toEqual({
      action: 'skip',
      reason: 'already_at_target',
    })
  })

  it('skip when en_route and current is en_route', () => {
    expect(computeMirrorAction('acknowledged', 'en_route', 'en_route')).toEqual({
      action: 'skip',
      reason: 'already_at_target',
    })
  })

  it('skip when on_scene and current is on_scene', () => {
    expect(computeMirrorAction('en_route', 'on_scene', 'on_scene')).toEqual({
      action: 'skip',
      reason: 'already_at_target',
    })
  })

  it('skip when resolved and current is resolved', () => {
    expect(computeMirrorAction('on_scene', 'resolved', 'resolved')).toEqual({
      action: 'skip',
      reason: 'already_at_target',
    })
  })

  // --- update: dispatchToReportState(after) differs from currentReportStatus ---
  it('update: accepted → acknowledged (current is assigned)', () => {
    expect(computeMirrorAction('pending', 'accepted', 'assigned')).toEqual({
      action: 'update',
      to: 'acknowledged',
    })
  })

  it('update: acknowledged → en_route', () => {
    expect(computeMirrorAction('accepted', 'acknowledged', 'assigned')).toEqual({
      action: 'update',
      to: 'acknowledged',
    })
  })

  it('update: en_route dispatch transitions report to en_route', () => {
    expect(computeMirrorAction('acknowledged', 'en_route', 'acknowledged')).toEqual({
      action: 'update',
      to: 'en_route',
    })
  })

  it('update: on_scene dispatch transitions report to on_scene', () => {
    expect(computeMirrorAction('en_route', 'on_scene', 'en_route')).toEqual({
      action: 'update',
      to: 'on_scene',
    })
  })

  it('update: resolved dispatch transitions report to resolved', () => {
    expect(computeMirrorAction('on_scene', 'resolved', 'on_scene')).toEqual({
      action: 'update',
      to: 'resolved',
    })
  })

  // --- all 10 × 10 transition matrix ---
  describe('all 10 × 10 dispatch state transitions', () => {
    const dispatchStatuses: DispatchStatus[] = [
      'pending',
      'accepted',
      'acknowledged',
      'en_route',
      'on_scene',
      'resolved',
      'declined',
      'timed_out',
      'cancelled',
      'superseded',
    ]

    const reportStatuses = [
      'verified',
      'assigned',
      'acknowledged',
      'en_route',
      'on_scene',
      'resolved',
    ] as const

    it.each(dispatchStatuses)('should not throw for any before status: %s', (before) => {
      expect(() => computeMirrorAction(before, 'accepted', 'assigned')).not.toThrow()
    })

    it.each(dispatchStatuses)('should not throw for any after status: %s', (after) => {
      expect(() => computeMirrorAction('pending', after, 'assigned')).not.toThrow()
    })

    it.each(reportStatuses)('should not throw for any currentReportStatus: %s', (current) => {
      expect(() => computeMirrorAction('pending', 'accepted', current)).not.toThrow()
    })
  })
})
