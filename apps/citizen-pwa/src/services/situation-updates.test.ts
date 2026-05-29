import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockAddDoc,
  mockCollection,
  mockDb,
  mockEnsureSignedIn,
  mockLimit,
  mockOnSnapshot,
  mockQuery,
  mockWhere,
} = vi.hoisted(() => ({
  mockAddDoc: vi.fn().mockResolvedValue({ id: 'new-update' }),
  mockCollection: vi.fn((_db: unknown, ...path: string[]) => path.join('/')),
  mockDb: vi.fn().mockReturnValue({}),
  mockEnsureSignedIn: vi.fn().mockResolvedValue('citizen-1'),
  mockLimit: vi.fn((count: number) => ({ type: 'limit', count })),
  mockOnSnapshot: vi.fn(),
  mockQuery: vi.fn((...parts: unknown[]) => ({ parts })),
  mockWhere: vi.fn((field: string, op: string, value: string) => ({ field, op, value })),
}))

vi.mock('firebase/firestore', () => ({
  addDoc: mockAddDoc,
  collection: mockCollection,
  limit: mockLimit,
  onSnapshot: mockOnSnapshot,
  query: mockQuery,
  where: mockWhere,
}))

vi.mock('./firebase.js', () => ({
  db: mockDb,
  ensureSignedIn: mockEnsureSignedIn,
}))

import {
  createSituationUpdate,
  reportSituationUpdate,
  subscribeSituationUpdates,
} from './situation-updates.js'

describe('situation updates service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAddDoc.mockResolvedValue({ id: 'new-update' })
    mockDb.mockReturnValue({})
    mockEnsureSignedIn.mockResolvedValue('citizen-1')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('writes a public situation update for the signed-in user', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1234)
    await createSituationUpdate({
      municipalityId: 'daet',
      municipalityLabel: 'Daet',
      barangayLabel: 'San Jose',
      hazardType: 'typhoon',
      condition: 'heavy_rain',
      body: '  Strong rain near the market.  ',
    })

    expect(mockAddDoc).toHaveBeenCalledWith('situation_updates', {
      authorUid: 'citizen-1',
      createdAt: 1234,
      municipalityId: 'daet',
      municipalityLabel: 'Daet',
      barangayLabel: 'San Jose',
      hazardType: 'typhoon',
      condition: 'heavy_rain',
      body: 'Strong rain near the market.',
      visibility: 'public',
      reportedCount: 0,
    })
  })

  it('omits blank optional barangay labels', async () => {
    await createSituationUpdate({
      municipalityId: 'daet',
      municipalityLabel: 'Daet',
      barangayLabel: '   ',
      hazardType: 'typhoon',
      condition: 'heavy_rain',
      body: 'Strong rain near the market.',
    })

    const payload = mockAddDoc.mock.calls[0]?.[1] as Record<string, unknown>
    expect(payload).not.toHaveProperty('barangayLabel')
  })

  it('writes moderation reports under the update', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(5678)
    await reportSituationUpdate('sit-1', 'Needs review')

    expect(mockAddDoc).toHaveBeenCalledWith('situation_updates/sit-1/reports', {
      reporterUid: 'citizen-1',
      reason: 'Needs review',
      createdAt: 5678,
    })
  })

  it('maps valid snapshots, skips invalid rows, and sorts newest first', () => {
    const onNext = vi.fn()
    const unsubscribe = vi.fn()
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    mockOnSnapshot.mockImplementation((_q: unknown, next: (snap: unknown) => void) => {
      next({
        docs: [
          {
            id: 'old',
            data: () => ({
              authorUid: 'citizen-1',
              createdAt: 100,
              municipalityId: 'daet',
              municipalityLabel: 'Daet',
              hazardType: 'typhoon',
              condition: 'heavy_rain',
              body: 'Older update',
              visibility: 'public',
            }),
          },
          { id: 'bad', data: () => ({ body: 'missing fields' }) },
          {
            id: 'new',
            data: () => ({
              authorUid: 'citizen-2',
              createdAt: 300,
              municipalityId: 'labo',
              municipalityLabel: 'Labo',
              barangayLabel: 'Talobatib',
              hazardType: 'flood',
              condition: 'flooding',
              body: 'Newer update',
              visibility: 'public',
              reportedCount: 0,
            }),
          },
        ],
      })
      return unsubscribe
    })

    const result = subscribeSituationUpdates(onNext)

    expect(result).toBe(unsubscribe)
    expect(mockWhere).toHaveBeenCalledWith('visibility', '==', 'public')
    expect(errorSpy).toHaveBeenCalledWith('Skipping invalid situation update document', 'bad')
    expect(onNext).toHaveBeenCalledWith([
      expect.objectContaining({ id: 'new', body: 'Newer update' }),
      expect.objectContaining({ id: 'old', body: 'Older update' }),
    ])
  })
})
