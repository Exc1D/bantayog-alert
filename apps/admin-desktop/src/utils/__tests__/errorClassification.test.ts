import { describe, expect, it } from 'vitest'
import { isRetryableActionError } from '../errorClassification'

describe('isRetryableActionError', () => {
  it.each(['permission-denied', 'permission denied', 'unauthorized', 'unauthenticated'])(
    'does not retry %s errors',
    (message) => {
      expect(isRetryableActionError(new Error(message))).toBe(false)
    },
  )

  it('retries transient errors', () => {
    expect(isRetryableActionError(new Error('Network split'))).toBe(true)
  })
})
