import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { Draft, SyncState } from '../services/draft-store'
import { _resetStorageCache } from '../services/draft-store'

// In-memory mock storage
const mockDraftData = new Map<string, Draft>()
const mockPhotoData = new Map<string, Blob>()

const mockDraftStorage = {
  getItem: vi.fn((key: string) => Promise.resolve(mockDraftData.get(key) ?? null)),
  setItem: vi.fn((key: string, value: Draft) => {
    mockDraftData.set(key, value)
    return Promise.resolve(value)
  }),
  removeItem: vi.fn((key: string) => {
    mockDraftData.delete(key)
    return Promise.resolve()
  }),
  keys: vi.fn(() => Promise.resolve(Array.from(mockDraftData.keys()))),
}

const mockPhotoStorage = {
  getItem: vi.fn((key: string) => Promise.resolve(mockPhotoData.get(key) ?? null)),
  setItem: vi.fn((key: string, value: Blob) => {
    mockPhotoData.set(key, value)
    return Promise.resolve(value)
  }),
  removeItem: vi.fn((key: string) => {
    mockPhotoData.delete(key)
    return Promise.resolve()
  }),
}

vi.mock('localforage', () => ({
  default: {
    createInstance: vi.fn((config: { name: string }) => {
      return config.name === 'bantayog-drafts' ? mockDraftStorage : mockPhotoStorage
    }),
  },
}))

import { draftStore } from '../services/draft-store'

function makeDraft(overrides: Partial<Draft> = {}): Draft {
  const now = Date.now()
  return {
    id: 'test-draft-1',
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

describe('draftStore', () => {
  beforeEach(() => {
    mockDraftData.clear()
    mockPhotoData.clear()
    vi.clearAllMocks()
    _resetStorageCache()
  })

  describe('save', () => {
    it('saves draft with updatedAt bumped to now', async () => {
      const draft = makeDraft()
      const before = Date.now()
      await draftStore.save(draft)
      const after = Date.now()

      expect(mockDraftStorage.setItem).toHaveBeenCalledOnce()
      const saved = mockDraftStorage.setItem.mock.calls[0]![1]
      expect(saved.updatedAt).toBeGreaterThanOrEqual(before)
      expect(saved.updatedAt).toBeLessThanOrEqual(after)
    })
  })

  describe('load', () => {
    it('returns draft and photoBlob when not expired', async () => {
      const draft = makeDraft()
      const photo = new Blob(['photo data'], { type: 'image/jpeg' })
      mockDraftData.set(draft.id, draft)
      mockPhotoData.set(draft.id, photo)

      const result = await draftStore.load(draft.id)

      expect(result).toBeTruthy()
      if (result && 'draft' in result && !('smsFallbackSentAt' in result)) {
        expect(result.draft.id).toBe(draft.id)
        expect(result.photoBlob).toBe(photo)
      }
    })

    it('returns null when draft does not exist', async () => {
      const result = await draftStore.load('nonexistent')
      expect(result).toBeNull()
    })

    it('deletes expired draft on load', async () => {
      const draft = makeDraft({ updatedAt: Date.now() - 25 * 3600 * 1000 })
      mockDraftData.set(draft.id, draft)

      const result = await draftStore.load(draft.id)

      expect(result).toBeNull()
      expect(mockDraftStorage.removeItem).toHaveBeenCalledWith(draft.id)
    })

    it('returns ExpiredDraftWithSmsFallback for expired draft with smsFallbackSentAt', async () => {
      const draft = makeDraft({
        updatedAt: Date.now() - 25 * 3600 * 1000,
        smsFallbackSentAt: Date.now() - 2 * 24 * 3600 * 1000,
      })
      mockDraftData.set(draft.id, draft)

      const result = await draftStore.load(draft.id)

      expect(result).toBeTruthy()
      if (result && 'smsFallbackSentAt' in result) {
        expect(result.smsFallbackSentAt).toBe(draft.smsFallbackSentAt)
      }
    })

    it('resets TTL on save (sliding window)', async () => {
      const draft = makeDraft({ updatedAt: Date.now() - 23 * 3600 * 1000 })
      mockDraftData.set(draft.id, draft)

      const before = Date.now()
      await draftStore.save(draft)
      const after = Date.now()

      expect(mockDraftStorage.setItem).toHaveBeenCalledWith(
        draft.id,
        expect.objectContaining({ updatedAt: expect.any(Number) }),
      )
      const saved = mockDraftStorage.setItem.mock.calls[0]![1]
      expect(saved.updatedAt).toBeGreaterThanOrEqual(before)
      expect(saved.updatedAt).toBeLessThanOrEqual(after)
    })

    it('72h TTL for syncing drafts', async () => {
      const draft = makeDraft({
        syncState: 'syncing',
        updatedAt: Date.now() - 48 * 3600 * 1000, // 48h ago — past 24h, before 72h
      })
      mockDraftData.set(draft.id, draft)

      const result = await draftStore.load(draft.id)

      // Should NOT be expired (72h TTL for syncing)
      expect(result).not.toBeNull()
      if (result && 'draft' in result) {
        expect(result.draft.syncState).toBe('syncing')
      }
    })
  })

  describe('clear', () => {
    it('removes draft and photo from storage', async () => {
      const draft = makeDraft()
      const photo = new Blob(['photo'], { type: 'image/jpeg' })
      mockDraftData.set(draft.id, draft)
      mockPhotoData.set(draft.id, photo)

      await draftStore.clear(draft.id)

      expect(mockDraftStorage.removeItem).toHaveBeenCalledWith(draft.id)
      expect(mockPhotoStorage.removeItem).toHaveBeenCalledWith(draft.id)
    })

    it('does not throw when photo removal fails (QuotaExceededError)', async () => {
      const draft = makeDraft()
      mockDraftData.set(draft.id, draft)
      mockPhotoStorage.removeItem.mockRejectedValueOnce(new Error('QuotaExceededError'))

      await expect(draftStore.clear(draft.id)).resolves.not.toThrow()
    })
  })

  describe('list', () => {
    it('returns only non-expired drafts', async () => {
      const fresh = makeDraft({ id: 'fresh', updatedAt: Date.now() })
      const stale = makeDraft({ id: 'stale', updatedAt: Date.now() - 48 * 3600 * 1000 })
      mockDraftData.set('fresh', fresh)
      mockDraftData.set('stale', stale)

      const result = await draftStore.list()

      expect(result.map((d) => d.id)).toContain('fresh')
      expect(result.map((d) => d.id)).not.toContain('stale')
    })

    it('returns empty array when no drafts exist', async () => {
      const result = await draftStore.list()
      expect(result).toEqual([])
    })
  })

  describe('recoverOrphaned', () => {
    it('returns drafts with syncState === syncing', async () => {
      const orphaned = makeDraft({ id: 'orphaned', syncState: 'syncing' as SyncState })
      const normal = makeDraft({ id: 'normal', syncState: 'local_only' as SyncState })
      mockDraftData.set('orphaned', orphaned)
      mockDraftData.set('normal', normal)

      const result = await draftStore.recoverOrphaned()

      expect(result.map((d) => d.id)).toContain('orphaned')
      expect(result.map((d) => d.id)).not.toContain('normal')
    })
  })

  describe('saveWithPhoto', () => {
    it('saves draft and photo separately', async () => {
      const draft = makeDraft()
      const photo = new Blob(['photo data'], { type: 'image/jpeg' })

      await draftStore.saveWithPhoto(draft, photo)

      expect(mockDraftStorage.setItem).toHaveBeenCalledWith(
        draft.id,
        expect.objectContaining({ id: draft.id }),
      )
      expect(mockPhotoStorage.setItem).toHaveBeenCalledWith(draft.id, photo)
    })
  })

  describe('photo blob recovery', () => {
    it('returns draft without photoBlob and removes photo when blob is unreadable', async () => {
      const draft = makeDraft()
      mockDraftData.set(draft.id, draft)

      // Create a blob whose slice().arrayBuffer() throws — simulating evicted storage
      const throwingArrayBuffer = vi.fn(() => Promise.reject(new Error('Blob evicted')))
      const badPhoto = {
        size: 5,
        type: 'image/jpeg',
        slice: () => ({ arrayBuffer: throwingArrayBuffer }),
        arrayBuffer: throwingArrayBuffer,
      } as unknown as Blob
      mockPhotoStorage.getItem.mockResolvedValueOnce(badPhoto)

      const result = await draftStore.load(draft.id)

      expect(result).toBeTruthy()
      if (result && 'draft' in result && !('smsFallbackSentAt' in result)) {
        expect(result.draft.id).toBe(draft.id)
        expect(result.photoBlob).toBeUndefined()
      }
      expect(mockPhotoStorage.removeItem).toHaveBeenCalledWith(draft.id)
    })
  })
})
