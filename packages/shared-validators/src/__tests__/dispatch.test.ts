import { describe, it, expect } from 'vitest'
import { validResponderTransition } from '../dispatch'

describe('validResponderTransition', () => {
  const allowed: [string, string][] = [
    ['accepted', 'acknowledged'],
    ['acknowledged', 'in_progress'],
    ['in_progress', 'resolved'],
    ['pending', 'declined'],
  ]

  allowed.forEach(([from, to]) => {
    it(`should allow ${from} → ${to}`, () => {
      expect(validResponderTransition(from, to)).toBe(true)
    })
  })

  const disallowed: [string, string][] = [
    ['pending', 'acknowledged'],
    ['pending', 'resolved'],
    ['accepted', 'resolved'],
    ['acknowledged', 'resolved'],
    ['resolved', 'acknowledged'],
    ['in_progress', 'acknowledged'],
    ['declined', 'accepted'],
  ]

  disallowed.forEach(([from, to]) => {
    it(`should reject ${from} → ${to}`, () => {
      expect(validResponderTransition(from, to)).toBe(false)
    })
  })
})
