import { describe, expect, it } from 'vitest'
import {
  getResponderUiState,
  groupDispatchRows,
  getSingleActiveDispatchId,
  getTerminalSurface,
} from './dispatch-presentation.js'

describe('dispatch-presentation', () => {
  it('collapses accepted, acknowledged, and en_route into heading_to_scene', () => {
    expect(getResponderUiState('accepted')).toBe('heading_to_scene')
    expect(getResponderUiState('acknowledged')).toBe('heading_to_scene')
    expect(getResponderUiState('en_route')).toBe('heading_to_scene')
  })

  it('maps on_scene to on_scene and resolved to resolved', () => {
    expect(getResponderUiState('on_scene')).toBe('on_scene')
    expect(getResponderUiState('resolved')).toBe('resolved')
  })

  it('groups pending and active rows separately', () => {
    const grouped = groupDispatchRows([
      { dispatchId: 'd1', reportId: 'r1', status: 'pending', dispatchedAt: 3 },
      { dispatchId: 'd2', reportId: 'r2', status: 'acknowledged', dispatchedAt: 2 },
      { dispatchId: 'd3', reportId: 'r3', status: 'on_scene', dispatchedAt: 1 },
    ])

    expect(grouped.pending.map((row) => row.dispatchId)).toEqual(['d1'])
    expect(grouped.active.map((row) => row.dispatchId)).toEqual(['d2', 'd3'])
  })

  it('returns the single active dispatch id only when exactly one active exists', () => {
    expect(getSingleActiveDispatchId([{ dispatchId: 'd1', status: 'en_route' }])).toBe('d1')
    expect(
      getSingleActiveDispatchId([
        { dispatchId: 'd1', status: 'en_route' },
        { dispatchId: 'd2', status: 'on_scene' },
      ]),
    ).toBeNull()
  })

  it('maps cancelled and timed_out to cancelled terminal surface', () => {
    expect(getTerminalSurface('cancelled')).toBe('cancelled')
    expect(getTerminalSurface('timed_out')).toBe('cancelled')
  })

  it('maps known race-loss codes to the race_loss terminal surface', () => {
    expect(getTerminalSurface('already-exists')).toBe('race_loss')
  })

  it('returns null terminal surface for active statuses', () => {
    expect(getTerminalSurface('on_scene')).toBeNull()
    expect(getTerminalSurface('en_route')).toBeNull()
  })
})
