import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useSmsAudit } from '../hooks/useSmsAudit'
import type { SmsOutboxDoc, SmsInboxDoc, SmsProviderHealthDoc } from '@bantayog/shared-validators'

const { mockOnSnapshot } = vi.hoisted(() => ({
  mockOnSnapshot: vi.fn(),
}))

vi.mock('firebase/firestore', () => ({
  collection: vi.fn((_db, path: string) => ({ _collectionPath: path })),
  onSnapshot: mockOnSnapshot,
  query: vi.fn((collRef) => collRef),
  orderBy: vi.fn(),
  limit: vi.fn(),
  getFirestore: vi.fn(() => ({})),
}))

vi.mock('@/app/firebase', () => ({
  db: {},
}))

describe('useSmsAudit', () => {
  beforeEach(() => {
    mockOnSnapshot.mockReset()
    vi.clearAllMocks()
  })

  it('returns loading state initially', () => {
    mockOnSnapshot.mockReturnValue(vi.fn())
    const { result } = renderHook(() => useSmsAudit())

    expect(result.current.loading).toBe(true)
    expect(result.current.outbox).toEqual([])
    expect(result.current.inbox).toEqual([])
    expect(result.current.providerHealth).toEqual([])
    expect(result.current.error).toBeNull()
  })

  it('returns outbox messages when snapshot succeeds', async () => {
    const mockOutbox: SmsOutboxDoc[] = [
      {
        providerId: 'semaphore',
        recipientMsisdnHash: 'a'.repeat(64),
        recipientMsisdn: '+639171234567',
        purpose: 'receipt_ack',
        predictedEncoding: 'GSM-7',
        predictedSegmentCount: 1,
        bodyPreviewHash: 'b'.repeat(64),
        status: 'delivered',
        idempotencyKey: 'key-1',
        retryCount: 0,
        locale: 'en',
        createdAt: Math.floor(Date.now() / 1000),
        queuedAt: Math.floor(Date.now() / 1000),
        schemaVersion: 2,
      },
    ]

    mockOnSnapshot.mockImplementation((queryArg, onNext) => {
      setTimeout(() => {
        if (queryArg?._collectionPath === 'sms_outbox') {
          onNext({
            docs: mockOutbox.map((doc) => ({
              id: 'outbox-1',
              data: () => doc,
            })),
          })
        } else {
          onNext({ docs: [] })
        }
      }, 0)
      return vi.fn()
    })

    const { result } = renderHook(() => useSmsAudit())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
      expect(result.current.outbox).toHaveLength(1)
    })

    expect(result.current.outbox[0]!.purpose).toBe('receipt_ack')
    expect(result.current.outbox[0]!.id).toBe('outbox-1')
    expect(result.current.error).toBeNull()
  })

  it('returns inbox messages when snapshot succeeds', async () => {
    const mockInbox: SmsInboxDoc[] = [
      {
        providerId: 'globelabs',
        receivedAt: Math.floor(Date.now() / 1000),
        senderMsisdnHash: 'c'.repeat(64),
        body: 'Flood in Barangay 1',
        parseStatus: 'parsed',
        parsedIntoInboxId: 'report-123',
        confidenceScore: 0.95,
        schemaVersion: 1,
      },
    ]

    mockOnSnapshot.mockImplementation((queryArg, onNext) => {
      if (queryArg?._collectionPath === 'sms_inbox') {
        setTimeout(() => {
          onNext({
            docs: mockInbox.map((doc) => ({
              id: 'inbox-1',
              data: () => doc,
            })),
          })
        }, 0)
      }
      return vi.fn()
    })

    const { result } = renderHook(() => useSmsAudit())

    await waitFor(() => {
      expect(result.current.inbox).toHaveLength(1)
    })

    expect(result.current.inbox[0]!.body).toBe('Flood in Barangay 1')
    expect(result.current.inbox[0]!.parseStatus).toBe('parsed')
  })

  it('returns provider health when snapshot succeeds', async () => {
    const mockHealth: SmsProviderHealthDoc[] = [
      {
        providerId: 'semaphore',
        circuitState: 'closed',
        errorRatePct: 0,
        updatedAt: Math.floor(Date.now() / 1000),
      },
    ]

    mockOnSnapshot.mockImplementation((queryArg, onNext) => {
      if (queryArg?._collectionPath === 'sms_provider_health') {
        setTimeout(() => {
          onNext({
            docs: mockHealth.map((doc) => ({
              id: 'health-semaphore',
              data: () => doc,
            })),
          })
        }, 0)
      }
      return vi.fn()
    })

    const { result } = renderHook(() => useSmsAudit())

    await waitFor(() => {
      expect(result.current.providerHealth).toHaveLength(1)
    })

    expect(result.current.providerHealth[0]!.circuitState).toBe('closed')
    expect(result.current.providerHealth[0]!.errorRatePct).toBe(0)
  })

  it('returns error when snapshot fails', async () => {
    const testError = new Error('Permission denied')
    mockOnSnapshot.mockImplementation((_queryArg, _onNext, onError) => {
      if (onError) {
        setTimeout(() => onError(testError), 0)
      }
      return vi.fn()
    })

    const { result } = renderHook(() => useSmsAudit())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.error).toContain('Permission denied')
    expect(result.current.outbox).toEqual([])
    expect(result.current.inbox).toEqual([])
    expect(result.current.providerHealth).toEqual([])
  })

  it('unsubscribes on unmount', () => {
    const unsubOutbox = vi.fn()
    const unsubInbox = vi.fn()
    const unsubHealth = vi.fn()

    mockOnSnapshot.mockImplementation((queryArg) => {
      if (queryArg?._collectionPath === 'sms_outbox') return unsubOutbox
      if (queryArg?._collectionPath === 'sms_inbox') return unsubInbox
      if (queryArg?._collectionPath === 'sms_provider_health') return unsubHealth
      return vi.fn()
    })

    const { unmount } = renderHook(() => useSmsAudit())

    unmount()

    expect(unsubOutbox).toHaveBeenCalledTimes(1)
    expect(unsubInbox).toHaveBeenCalledTimes(1)
    expect(unsubHealth).toHaveBeenCalledTimes(1)
  })

  it('filters out malformed documents', async () => {
    const mockOutbox = [
      {
        providerId: 'semaphore',
        recipientMsisdnHash: 'a'.repeat(64),
        recipientMsisdn: '+639171234567',
        purpose: 'receipt_ack',
        predictedEncoding: 'GSM-7',
        predictedSegmentCount: 1,
        bodyPreviewHash: 'b'.repeat(64),
        status: 'delivered',
        idempotencyKey: 'key-1',
        retryCount: 0,
        locale: 'en',
        createdAt: Math.floor(Date.now() / 1000),
        queuedAt: Math.floor(Date.now() / 1000),
        schemaVersion: 2,
      },
      {
        providerId: 'semaphore',
        // Missing required fields: recipientMsisdnHash, recipientMsisdn, purpose, etc.
        status: 'queued',
        createdAt: Math.floor(Date.now() / 1000),
        queuedAt: Math.floor(Date.now() / 1000),
        schemaVersion: 2,
      },
    ]

    mockOnSnapshot.mockImplementation((queryArg, onNext) => {
      setTimeout(() => {
        if (queryArg?._collectionPath === 'sms_outbox') {
          onNext({
            docs: mockOutbox.map((doc, idx) => ({
              id: `outbox-${String(idx)}`,
              data: () => doc,
            })),
          })
        } else {
          onNext({ docs: [] })
        }
      }, 0)
      return vi.fn()
    })

    const { result } = renderHook(() => useSmsAudit())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
      expect(result.current.outbox).toHaveLength(1)
    })

    expect(result.current.outbox[0]!.id).toBe('outbox-0')
  })

  it('handles partial failure: outbox success + inbox error', async () => {
    const mockOutbox: SmsOutboxDoc[] = [
      {
        providerId: 'semaphore',
        recipientMsisdnHash: 'a'.repeat(64),
        recipientMsisdn: '+639171234567',
        purpose: 'receipt_ack',
        predictedEncoding: 'GSM-7',
        predictedSegmentCount: 1,
        bodyPreviewHash: 'b'.repeat(64),
        status: 'delivered',
        idempotencyKey: 'key-1',
        retryCount: 0,
        locale: 'en',
        createdAt: Math.floor(Date.now() / 1000),
        queuedAt: Math.floor(Date.now() / 1000),
        schemaVersion: 2,
      },
    ]

    const inboxError = new Error('Inbox permission denied')

    mockOnSnapshot.mockImplementation((queryArg, onNext, onError) => {
      setTimeout(() => {
        if (queryArg?._collectionPath === 'sms_outbox') {
          onNext({
            docs: mockOutbox.map((doc) => ({
              id: 'outbox-1',
              data: () => doc,
            })),
          })
        } else if (queryArg?._collectionPath === 'sms_inbox') {
          if (onError) onError(inboxError)
        } else {
          onNext({ docs: [] })
        }
      }, 0)
      return vi.fn()
    })

    const { result } = renderHook(() => useSmsAudit())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.outbox).toHaveLength(1)
    expect(result.current.error).toContain('Inbox permission denied')
  })

  it('handles non-Error error objects with fallback message', async () => {
    mockOnSnapshot.mockImplementation((_queryArg, _onNext, onError) => {
      if (onError) {
        setTimeout(() => onError('Plain string error'), 0)
      }
      return vi.fn()
    })

    const { result } = renderHook(() => useSmsAudit())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.error).toContain('Failed to fetch SMS outbox')
  })

  it('waits for all three subscriptions before setting loading to false', async () => {
    mockOnSnapshot.mockImplementation((queryArg, onNext) => {
      if (queryArg?._collectionPath === 'sms_outbox') {
        setTimeout(() => {
          onNext({ docs: [] })
        }, 0)
      }
      // inbox and health never fire
      return vi.fn()
    })

    const { result } = renderHook(() => useSmsAudit())

    // Wait a tick to let the outbox callback fire
    await new Promise((resolve) => setTimeout(resolve, 10))

    // Loading should still be true because only 1 of 3 subscriptions responded
    expect(result.current.loading).toBe(true)
    expect(result.current.outbox).toEqual([])
  })
})
