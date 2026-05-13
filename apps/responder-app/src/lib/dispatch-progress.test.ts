import { describe, expect, it } from 'vitest'
import {
  formatCountdownLabel,
  getDispatchProgress,
  getNextActionLabel,
  getRingStrokeOffset,
  getStepValue,
} from './dispatch-progress'

describe('dispatch-progress', () => {
  it.each([
    ['pending', 0],
    ['accepted', 20],
    ['acknowledged', 40],
    ['heading_to_scene', 60],
    ['en_route', 60],
    ['on_scene', 80],
    ['resolved', 100],
  ] as const)('maps %s to %i percent', (status, expected) => {
    expect(getDispatchProgress(status)).toBe(expected)
  })

  it.each([
    ['acknowledged', 'Mark En Route'],
    ['en_route', 'Mark On Scene'],
    ['heading_to_scene', 'Mark On Scene'],
    ['on_scene', 'Mark Resolved'],
    ['resolved', 'View Summary'],
  ] as const)('maps %s to the next action label', (status, expected) => {
    expect(getNextActionLabel(status)).toBe(expected)
  })

  it('maps current step to a progressbar value', () => {
    expect(getStepValue('pending')).toEqual({ value: 0, text: 'Pending acceptance' })
    expect(getStepValue('accepted')).toEqual({ value: 0, text: 'Accepted' })
    expect(getStepValue('on_scene')).toEqual({ value: 3, text: 'On Scene' })
  })

  it('computes stroke offset from percent and radius', () => {
    expect(getRingStrokeOffset(50, 10)).toBeCloseTo(Math.PI * 10)
  })

  it('formats urgent countdown labels', () => {
    expect(formatCountdownLabel(59_000)).toBe('Accept in 0 minutes 59 seconds urgent')
    expect(formatCountdownLabel(272_000)).toBe('Accept in 4 minutes 32 seconds')
  })
})
