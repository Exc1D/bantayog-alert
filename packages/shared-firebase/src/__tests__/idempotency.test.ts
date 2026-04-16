import { describe, it, expect } from 'vitest'
import { generateIdempotencyKey, parseIdempotencyKey } from '../idempotency'

describe('generateIdempotencyKey', () => {
  it('should produce a key from actor + commandType + logicalTarget', () => {
    const key = generateIdempotencyKey('uid_123', 'dispatchResponder', 'report_abc')
    expect(key).toBe('uid_123:dispatchResponder:report_abc')
  })

  it('should produce deterministic keys for same inputs', () => {
    const a = generateIdempotencyKey('uid_1', 'verifyReport', 'rpt_1')
    const b = generateIdempotencyKey('uid_1', 'verifyReport', 'rpt_1')
    expect(a).toBe(b)
  })

  it('should produce different keys for different inputs', () => {
    const a = generateIdempotencyKey('uid_1', 'verifyReport', 'rpt_1')
    const b = generateIdempotencyKey('uid_1', 'verifyReport', 'rpt_2')
    expect(a).not.toBe(b)
  })
})

describe('parseIdempotencyKey', () => {
  it('should round-trip from generate', () => {
    const key = generateIdempotencyKey('uid_1', 'acceptDispatch', 'dsp_99')
    const parsed = parseIdempotencyKey(key)
    expect(parsed).toEqual({
      actorId: 'uid_1',
      commandType: 'acceptDispatch',
      logicalTarget: 'dsp_99',
    })
  })

  it('should return null for malformed keys', () => {
    expect(parseIdempotencyKey('bad')).toBeNull()
    expect(parseIdempotencyKey('a:b')).toBeNull()
  })
})
