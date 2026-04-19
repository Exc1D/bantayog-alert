import { describe, expect, it } from 'vitest'
import { dispatchToReportState } from '../dispatch-to-report.js'
import type { DispatchStatus } from '../../dispatches.js'

describe('dispatchToReportState', () => {
  const cases: [DispatchStatus, ReturnType<typeof dispatchToReportState>][] = [
    ['pending', null],
    ['accepted', 'acknowledged'],
    ['acknowledged', 'acknowledged'],
    ['en_route', 'en_route'],
    ['on_scene', 'on_scene'],
    ['resolved', 'resolved'],
    ['declined', null],
    ['timed_out', null],
    ['cancelled', null],
    ['superseded', null],
  ]
  it.each(cases)('maps %s → %s', (from, expected) => {
    expect(dispatchToReportState(from)).toBe(expected)
  })
})
