import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { DraftReport } from '../localforage'

const store = new Map<string, DraftReport>()

const mockSaveDraft = vi.fn((draft: DraftReport) => {
  store.set(draft.uuid, draft)
})

const mockGetDraft = vi.fn((uuid: string) => {
  return store.get(uuid) ?? null
})

vi.mock('../localforage', () => ({
  saveDraft: (...args: [draft: DraftReport]) => { mockSaveDraft(...args); },
  getDraft: (...args: [uuid: string]) => mockGetDraft(...args),
}))

let uuidCounter = 0
vi.stubGlobal('crypto', {
  randomUUID: () => `test-uuid-${String(++uuidCounter)}`,
})

import {
  createDraft,
  updateDraft,
  transitionDraftToFailed,
  incrementDraftRetry,
  promoteDraftToSuccess,
} from '../draftManager'

function makeInput(
  overrides: Partial<Omit<DraftReport, 'uuid' | 'createdAt' | 'state' | 'submittedRef' | 'lastError' | 'retryCount'>> = {},
) {
  return {
    reportType: 'flood',
    hazardClass: 'natural',
    description: 'Water rising',
    location: { lat: 14.5, lng: 121.0, address: 'Quezon City' },
    reporterName: 'Juan',
    reporterMsisdn: '+639171234567',
    patientCount: 0,
    ...overrides,
  }
}

describe('draftManager', () => {
  beforeEach(() => {
    store.clear()
    uuidCounter = 0
    vi.clearAllMocks()
  })

  describe('createDraft', () => {
    it('saves draft with state queued and returns uuid', async () => {
      const uuid = await createDraft(makeInput())

      expect(uuid).toBe('test-uuid-1')
      expect(mockSaveDraft).toHaveBeenCalledOnce()
      const saved = mockSaveDraft.mock.calls[0]![0]
      expect(saved.uuid).toBe('test-uuid-1')
      expect(saved.state).toBe('queued')
      expect(saved.reportType).toBe('flood')
      expect(typeof saved.createdAt).toBe('number')
    })

    it('persists to store so getDraft returns it', async () => {
      const uuid = await createDraft(makeInput({ reporterName: 'Maria' }))
      const draft = store.get(uuid)

      expect(draft).toBeDefined()
      expect(draft!.reporterName).toBe('Maria')
    })
  })

  describe('updateDraft', () => {
    it('merges partial updates into existing draft', async () => {
      const uuid = await createDraft(makeInput())
      await updateDraft(uuid, { description: 'Updated desc' })

      const draft = store.get(uuid)!
      expect(draft.description).toBe('Updated desc')
      expect(draft.reportType).toBe('flood')
    })

    it('preserves uuid even if updates contain a different one', async () => {
      const uuid = await createDraft(makeInput())
      await updateDraft(uuid, { uuid: 'hijacked-uuid', description: 'nope' })

      const draft = store.get(uuid)!
      expect(draft.uuid).toBe(uuid)
    })

    it('throws if draft not found', async () => {
      await expect(updateDraft('nonexistent', { description: 'x' })).rejects.toThrow('Draft not found')
    })
  })

  describe('transitionDraftToFailed', () => {
    it('sets state to failed_retryable and adds lastError with timestamp', async () => {
      const uuid = await createDraft(makeInput())
      const before = Date.now()
      await transitionDraftToFailed(uuid, { code: 'NETWORK_ERROR', message: 'timeout' })
      const after = Date.now()

      const draft = store.get(uuid)!
      expect(draft.state).toBe('failed_retryable')
      expect(draft.lastError).toBeDefined()
      expect(draft.lastError!.code).toBe('NETWORK_ERROR')
      expect(draft.lastError!.message).toBe('timeout')
      expect(draft.lastError!.timestamp).toBeGreaterThanOrEqual(before)
      expect(draft.lastError!.timestamp).toBeLessThanOrEqual(after)
    })

    it('throws if draft not found', async () => {
      await expect(
        transitionDraftToFailed('nonexistent', { code: 'X', message: 'Y' }),
      ).rejects.toThrow('Draft not found')
    })
  })

  describe('incrementDraftRetry', () => {
    it('starts retryCount at 1 when undefined', async () => {
      const uuid = await createDraft(makeInput())
      await incrementDraftRetry(uuid)

      expect(store.get(uuid)!.retryCount).toBe(1)
    })

    it('increments existing retryCount', async () => {
      const uuid = await createDraft(makeInput())
      await incrementDraftRetry(uuid)
      await incrementDraftRetry(uuid)
      await incrementDraftRetry(uuid)

      expect(store.get(uuid)!.retryCount).toBe(3)
    })

    it('throws if draft not found', async () => {
      await expect(incrementDraftRetry('nonexistent')).rejects.toThrow('Draft not found')
    })
  })

  describe('promoteDraftToSuccess', () => {
    it('sets state to draft, adds submittedRef, removes lastError', async () => {
      const uuid = await createDraft(makeInput())
      await transitionDraftToFailed(uuid, { code: 'TIMEOUT', message: 'slow' })
      await promoteDraftToSuccess(uuid, 'ref-abc123')

      const draft = store.get(uuid)!
      expect(draft.state).toBe('draft')
      expect(draft.submittedRef).toBe('ref-abc123')
      expect(draft.lastError).toBeUndefined()
    })

    it('throws if draft not found', async () => {
      await expect(promoteDraftToSuccess('nonexistent', 'ref-x')).rejects.toThrow('Draft not found')
    })
  })
})
