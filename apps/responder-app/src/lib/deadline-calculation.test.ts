import { describe, expect, it } from 'vitest'
import { Timestamp } from 'firebase/firestore'
import { calculateDeadlineMinutes } from './deadline-calculation.js'

describe('calculateDeadlineMinutes', () => {
  it('returns fallback when deadline is missing', () => {
    const dispatchedAt = Timestamp.fromMillis(1000)
    expect(calculateDeadlineMinutes(undefined, dispatchedAt)).toBe(3)
  })

  it('returns fallback when dispatchedAt is missing', () => {
    const deadlineAt = Timestamp.fromMillis(60000)
    expect(calculateDeadlineMinutes(deadlineAt, undefined)).toBe(3)
  })

  it('calculates correct minutes from timestamps', () => {
    const dispatchedAt = Timestamp.fromMillis(0)
    const deadlineAt = Timestamp.fromMillis(5 * 60000) // 5 minutes
    expect(calculateDeadlineMinutes(deadlineAt, dispatchedAt)).toBe(5)
  })

  it('rounds to nearest minute', () => {
    const dispatchedAt = Timestamp.fromMillis(0)
    const deadlineAt = Timestamp.fromMillis(5 * 60000 + 30000) // 5.5 minutes
    expect(calculateDeadlineMinutes(deadlineAt, dispatchedAt)).toBe(6)
  })

  it('never returns less than 1 minute', () => {
    const dispatchedAt = Timestamp.fromMillis(0)
    const deadlineAt = Timestamp.fromMillis(100) // less than 1 minute
    expect(calculateDeadlineMinutes(deadlineAt, dispatchedAt)).toBe(1)
  })

  it('uses custom fallback when provided', () => {
    expect(calculateDeadlineMinutes(undefined, undefined, 5)).toBe(5)
  })
})
