import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const { mockInstance } = vi.hoisted(() => {
  const store = new Map<string, unknown>()
  const mockInstance = {
    getItem: vi.fn((key: string) => Promise.resolve(store.get(key) ?? null)),
    setItem: vi.fn((key: string, value: unknown) => {
      store.set(key, value)
      return Promise.resolve(value)
    }),
    removeItem: vi.fn((key: string) => {
      store.delete(key)
      return Promise.resolve()
    }),
    _store: store,
  }
  return { mockInstance }
})

vi.mock('localforage', () => ({
  default: { createInstance: () => mockInstance },
}))

import {
  wizardSnapshot,
  _resetWizardSnapshotCache,
  type WizardSnapshot,
} from './wizard-snapshot.js'

const STORAGE_KEY = 'wizard-in-progress'

beforeEach(() => {
  mockInstance._store.clear()
  vi.clearAllMocks()
  _resetWizardSnapshotCache()
  vi.useFakeTimers({ now: Date.now() })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('wizardSnapshot.load', () => {
  it('returns null when no snapshot exists', async () => {
    expect(await wizardSnapshot.load()).toBeNull()
  })

  it('returns the snapshot when fresh', async () => {
    await wizardSnapshot.save({
      step: 2,
      step1: { reportType: 'flood' },
      step2: null,
    })
    const loaded = await wizardSnapshot.load()
    expect(loaded?.step).toBe(2)
    expect(loaded?.step1?.reportType).toBe('flood')
    expect(loaded?.step2).toBeNull()
  })

  it('returns null when snapshot exceeds 24h TTL and clears stale data', async () => {
    await wizardSnapshot.save({ step: 1, step1: null, step2: null })
    vi.setSystemTime(Date.now() + 25 * 60 * 60 * 1000)
    expect(await wizardSnapshot.load()).toBeNull()
    expect(mockInstance.removeItem).toHaveBeenCalledOnce()
  })

  it('returns null when localforage rejects on read', async () => {
    mockInstance.getItem.mockRejectedValueOnce(new Error('idb broken'))
    expect(await wizardSnapshot.load()).toBeNull()
  })
})

describe('wizardSnapshot.save', () => {
  it('persists step + formData and stamps updatedAt', async () => {
    const before = Date.now()
    await wizardSnapshot.save({
      step: 3,
      step1: { reportType: 'fire' },
      step2: {
        location: { lat: 14.1, lng: 122.9 },
        reporterName: 'Juan',
        reporterMsisdn: '+639171234567',
        patientCount: 0,
        locationMethod: 'gps',
      },
    })
    const stored = mockInstance._store.get(STORAGE_KEY) as WizardSnapshot
    expect(stored.step).toBe(3)
    expect(stored.step2?.reporterName).toBe('Juan')
    expect(stored.updatedAt).toBeGreaterThanOrEqual(before)
  })

  it('does not throw when localforage rejects on save', async () => {
    mockInstance.setItem.mockRejectedValueOnce(new Error('idb broken'))
    await expect(
      wizardSnapshot.save({ step: 1, step1: null, step2: null }),
    ).resolves.toBeUndefined()
  })
})

describe('wizardSnapshot.clear', () => {
  it('removes the snapshot', async () => {
    await wizardSnapshot.save({ step: 1, step1: { reportType: 'flood' }, step2: null })
    await wizardSnapshot.clear()
    expect(await wizardSnapshot.load()).toBeNull()
  })

  it('does not throw when removeItem rejects', async () => {
    mockInstance.removeItem.mockRejectedValueOnce(new Error('idb broken'))
    await expect(wizardSnapshot.clear()).resolves.toBeUndefined()
  })
})
