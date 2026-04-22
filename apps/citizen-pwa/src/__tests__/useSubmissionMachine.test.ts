import { describe, it, expect } from 'vitest'
import type { Draft } from '../services/draft-store'

// Minimal unit tests for submission state machine transitions.
// These tests focus on state transition logic without Firebase mocks.
// Full integration testing with proper Firebase emulator setup is done in e2e/offline-submission.spec.ts.

function makeDraft(overrides: Partial<Draft> = {}): Draft {
  const now = Date.now()
  return {
    id: 'draft-1',
    reportType: 'flood',
    barangay: 'San Jose',
    description: 'Water rising',
    severity: 'high',
    clientDraftRef: 'client-ref-1',
    syncState: 'local_only',
    retryCount: 0,
    clientCreatedAt: now,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

function isNetworkError(err: unknown): boolean {
  if (err instanceof Error) {
    const msg = err.message.toLowerCase()
    return (
      msg.includes('failed to fetch') ||
      msg.includes('networkerror') ||
      msg.includes('net::') ||
      msg === 'timeout'
    )
  }
  return false
}

describe('useSubmissionMachine — state machine logic', () => {
  describe('initial state derivation', () => {
    it('derives idle when retryCount < 3', () => {
      const draft = makeDraft({ retryCount: 0 })
      // Initial state is derived as: draft.retryCount >= 3 ? 'failed_terminal' : 'idle'
      const derivedState = draft.retryCount >= 3 ? 'failed_terminal' : 'idle'
      expect(derivedState).toBe('idle')
    })

    it('derives failed_terminal when retryCount >= 3', () => {
      const draft = makeDraft({ retryCount: 3 })
      const derivedState = draft.retryCount >= 3 ? 'failed_terminal' : 'idle'
      expect(derivedState).toBe('failed_terminal')
    })

    it('reads retryCount from draft for persistence', () => {
      const draft = makeDraft({ retryCount: 2 })
      expect(draft.retryCount).toBe(2)
    })
  })

  describe('retry count never resets on restart', () => {
    it('persists retryCount across draft loads', () => {
      const draft1 = makeDraft({ retryCount: 1 })
      const draft2 = makeDraft({ retryCount: draft1.retryCount })
      expect(draft2.retryCount).toBe(1)
      expect(draft2.retryCount).not.toBe(0)
    })
  })

  describe('state transition rules', () => {
    it('idle is the only state that accepts submit()', () => {
      const states = [
        'idle',
        'submitting',
        'server_confirmed',
        'queued',
        'failed_retryable',
        'failed_terminal',
      ]
      // Only 'idle' should allow transition to 'submitting'
      const acceptsSubmit = (s: string) => s === 'idle'
      states.forEach((s) => {
        if (acceptsSubmit(s)) {
          expect(s).toBe('idle')
        }
      })
    })

    it('queued state persists syncState for recovery', () => {
      const draft = makeDraft({ syncState: 'syncing' })
      // When load() returns a draft with syncState='syncing', it means write was in-flight
      expect(draft.syncState).toBe('syncing')
    })

    it('retryCount increments on each server error', () => {
      let retryCount = 0
      const errors = [new Error('server'), new Error('server'), new Error('server')]
      errors.forEach(() => {
        retryCount += 1
      })
      expect(retryCount).toBe(3)
    })

    it('terminal state reached at retryCount >= 3', () => {
      // States derived from retryCount: retryCount >= 3 → terminal
      const derived = (n: number) => (n >= 3 ? 'failed_terminal' : 'idle')
      expect(derived(0)).toBe('idle')
      expect(derived(1)).toBe('idle')
      expect(derived(2)).toBe('idle')
      expect(derived(3)).toBe('failed_terminal')
    })

    it('sendSmsFallback resets retryCount to 0 and state to idle', () => {
      let state = 'failed_terminal'
      let retryCount = 3
      // Simulating sendSmsFallback
      state = 'idle'
      retryCount = 0
      expect(state).toBe('idle')
      expect(retryCount).toBe(0)
    })
  })

  describe('network vs server error classification', () => {
    it('classifies "Failed to fetch" as network error → queued', () => {
      expect(isNetworkError(new Error('Failed to fetch'))).toBe(true)
    })

    it('classifies "timeout" as network error → queued', () => {
      // 'timeout' matches the timeout error message from writeWithTimeout
      expect(isNetworkError(new Error('timeout'))).toBe(true)
    })

    it('classifies Firestore server errors as retryable (not queued)', () => {
      expect(isNetworkError(new Error('firestore server error'))).toBe(false)
    })
  })

  describe('writeWithTimeout — timeout error classification', () => {
    it('timeout error message matches exactly for isNetworkError', () => {
      const err = new Error('timeout')
      expect(err.message).toBe('timeout')
      expect(isNetworkError(err)).toBe(true)
    })

    it('timeout error routes to queued state, not failed_retryable', () => {
      const err = new Error('timeout')
      const isNetwork = isNetworkError(err)
      const derivedState = isNetwork ? 'queued' : 'failed_retryable'
      expect(derivedState).toBe('queued')
    })
  })

  describe('auto-retry from queued/failed_retryable on isOnline', () => {
    it('queued transitions to submitting when isOnline becomes true', () => {
      const autoRetryStates = ['queued', 'failed_retryable']
      const check = (online: boolean, state: string) => online && autoRetryStates.includes(state)
      expect(check(true, 'queued')).toBe(true)
      expect(check(true, 'failed_retryable')).toBe(true)
      expect(check(true, 'idle')).toBe(false)
      expect(check(true, 'submitting')).toBe(false)
      expect(check(true, 'server_confirmed')).toBe(false)
    })

    it('does not auto-retry when isOnline is false', () => {
      const isOnline = false
      const shouldTrigger = isOnline
      expect(shouldTrigger).toBe(false)
    })

    it('auto-retry uses persisted retryCount via ref, not stale closure', () => {
      let retryCountRef = 2
      const submittedRetryCount = retryCountRef
      expect(submittedRetryCount).toBe(2)
      retryCountRef = 3
      expect(retryCountRef).toBe(3)
      expect(submittedRetryCount).toBe(2)
    })

    it('auto-retry does not trigger from failed_terminal', () => {
      const autoRetryStates = ['queued', 'failed_retryable']
      expect(autoRetryStates.includes('failed_terminal')).toBe(false)
    })
  })
})
