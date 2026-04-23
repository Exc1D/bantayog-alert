import localforage from 'localforage'
import type { ReportType, Severity } from '@bantayog/shared-types'

export type SyncState = 'local_only' | 'syncing' | 'synced'

export interface Draft {
  id: string
  reportType: ReportType
  barangay: string
  barangayId?: string
  description: string
  severity: Severity
  location?: { lat: number; lng: number }
  nearestLandmark?: string
  reporterName?: string
  /** SHA-256 only — never plaintext MSISDN */
  reporterMsisdnHash?: string
  /** Stable ID generated once at creation, used for deduplication */
  clientDraftRef: string
  syncState: SyncState
  retryCount: number
  smsFallbackSentAt?: number
  /** Stable timestamp for tiebreaking */
  clientCreatedAt: number
  createdAt: number
  updatedAt: number
}

export interface ExpiredDraftWithSmsFallback {
  draft: Draft
  smsFallbackSentAt: number
}

const TTL_NORMAL_MS = 24 * 3600 * 1000 // 24h
const TTL_SYNCING_MS = 72 * 3600 * 1000 // 72h for in-flight writes

interface DraftStorage {
  getItem(key: string): Promise<Draft | null>
  setItem(key: string, value: Draft): Promise<Draft>
  removeItem(key: string): Promise<void>
  keys(): Promise<string[]>
}

interface PhotoStorage {
  getItem(key: string): Promise<Blob | null>
  setItem(key: string, value: Blob): Promise<Blob>
  removeItem(key: string): Promise<void>
}

// Exported for test instrumentation — callers must call resetCache() before each test
let _draftStorage: DraftStorage | undefined
let _photoStorage: PhotoStorage | undefined

export function _resetStorageCache(): void {
  _draftStorage = undefined
  _photoStorage = undefined
}

function getDraftStorage(): DraftStorage {
  _draftStorage ??= localforage.createInstance({
    name: 'bantayog-drafts',
    storeName: 'drafts',
  }) as unknown as DraftStorage
  return _draftStorage
}

function getPhotoStorage(): PhotoStorage {
  _photoStorage ??= localforage.createInstance({
    name: 'bantayog-photos',
    storeName: 'photos',
  }) as unknown as PhotoStorage
  return _photoStorage
}

async function isBlobReadable(blob: Blob): Promise<boolean> {
  try {
    await blob.slice(0, 1).arrayBuffer()
    return true
  } catch (_err: unknown) {
    void _err
    return false
  }
}

export const draftStore = {
  async save(draft: Draft): Promise<void> {
    const toSave: Draft = { ...draft, updatedAt: Date.now() }
    await getDraftStorage().setItem(draft.id, toSave)
  },

  async saveWithPhoto(draft: Draft, photoBlob: Blob): Promise<void> {
    const toSave: Draft = { ...draft, updatedAt: Date.now() }
    await getDraftStorage().setItem(draft.id, toSave)
    await getPhotoStorage().setItem(draft.id, photoBlob)
  },

  async load(
    id: string,
  ): Promise<{ draft: Draft; photoBlob?: Blob } | ExpiredDraftWithSmsFallback | null> {
    const draft = await getDraftStorage().getItem(id)
    if (!draft) return null

    const ttl = draft.syncState === 'syncing' ? TTL_SYNCING_MS : TTL_NORMAL_MS
    const isExpired = Date.now() - draft.updatedAt > ttl

    if (isExpired) {
      if (draft.smsFallbackSentAt) {
        const result: ExpiredDraftWithSmsFallback = {
          draft,
          smsFallbackSentAt: draft.smsFallbackSentAt,
        }
        await this.clear(id)
        return result
      }
      await this.clear(id)
      return null
    }

    const photoBlob = await getPhotoStorage()
      .getItem(id)
      .catch(() => null)
    if (photoBlob) {
      const readable = await isBlobReadable(photoBlob)
      if (!readable) {
        await getPhotoStorage()
          .removeItem(id)
          .catch((_e: unknown) => {
            void _e
          })
        return { draft }
      }
      return { draft, photoBlob }
    }

    return { draft }
  },

  async clear(id: string): Promise<void> {
    await getDraftStorage().removeItem(id)
    await getPhotoStorage()
      .removeItem(id)
      .catch((_e: unknown) => {
        void _e
      })
  },

  async list(): Promise<Draft[]> {
    const fresh: Draft[] = []
    const keys = await getDraftStorage().keys()
    for (const key of keys) {
      const draft = await getDraftStorage().getItem(key)
      if (!draft) continue
      const ttl = draft.syncState === 'syncing' ? TTL_SYNCING_MS : TTL_NORMAL_MS
      if (Date.now() - draft.updatedAt <= ttl) {
        fresh.push(draft)
      } else {
        await this.clear(draft.id).catch((_e: unknown) => {
          void _e
        })
      }
    }
    return fresh
  },

  async recoverOrphaned(): Promise<Draft[]> {
    const all = await this.list()
    return all.filter((d) => d.syncState === 'syncing')
  },
}
