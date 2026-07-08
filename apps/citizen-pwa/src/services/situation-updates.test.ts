import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockAddDoc,
  mockCallable,
  mockCollection,
  mockDb,
  mockEnsureSignedIn,
  mockFns,
  mockHttpsCallable,
  mockLimit,
  mockOnSnapshot,
  mockOrderBy,
  mockQuery,
  mockWhere,
} = vi.hoisted(() => {
  const mockCallable = vi.fn().mockResolvedValue({ data: { updateId: 'new-update' } })
  return {
    mockAddDoc: vi.fn().mockResolvedValue({ id: 'new-update' }),
    mockCallable,
    mockCollection: vi.fn((_db: unknown, ...path: string[]) => path.join('/')),
    mockDb: vi.fn().mockReturnValue({}),
    mockEnsureSignedIn: vi.fn().mockResolvedValue('citizen-1'),
    mockFns: vi.fn().mockReturnValue({}),
    mockHttpsCallable: vi.fn(() => mockCallable),
    mockLimit: vi.fn((count: number) => ({ type: 'limit', count })),
    mockOnSnapshot: vi.fn(),
    mockOrderBy: vi.fn((field: string, direction: string) => ({ field, direction })),
    mockQuery: vi.fn((...parts: unknown[]) => ({ parts })),
    mockWhere: vi.fn((field: string, op: string, value: string) => ({ field, op, value })),
  }
})

vi.mock('firebase/firestore', () => ({
  addDoc: mockAddDoc,
  collection: mockCollection,
  limit: mockLimit,
  onSnapshot: mockOnSnapshot,
  orderBy: mockOrderBy,
  query: mockQuery,
  where: mockWhere,
}))

vi.mock('firebase/functions', () => ({
  httpsCallable: mockHttpsCallable,
}))

vi.mock('./firebase.js', () => ({
  db: mockDb,
  ensureSignedIn: mockEnsureSignedIn,
  fns: mockFns,
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
    mockCallable.mockResolvedValue({ data: { updateId: 'new-update' } })
    mockHttpsCallable.mockReturnValue(mockCallable)
    mockDb.mockReturnValue({})
    mockEnsureSignedIn.mockResolvedValue('citizen-1')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('posts through the createSituationUpdate callable for the signed-in user', async () => {
    const updateId = await createSituationUpdate({
      municipalityId: 'daet',
      municipalityLabel: 'Daet',
      barangayLabel: 'San Jose',
      hazardType: 'typhoon',
      condition: 'heavy_rain',
      body: '  Strong rain near the market.  ',
    })

    expect(updateId).toBe('new-update')
    expect(mockHttpsCallable).toHaveBeenCalledWith(expect.anything(), 'createSituationUpdate')
    expect(mockCallable).toHaveBeenCalledWith({
      municipalityId: 'daet',
      municipalityLabel: 'Daet',
      barangayLabel: 'San Jose',
      hazardType: 'typhoon',
      condition: 'heavy_rain',
      body: 'Strong rain near the market.',
    })
    expect(mockAddDoc).not.toHaveBeenCalled()
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

    const payload = mockCallable.mock.calls[0]?.[0] as Record<string, unknown>
    expect(payload).not.toHaveProperty('barangayLabel')
  })

  it('rejects a malformed callable response', async () => {
    mockCallable.mockResolvedValue({ data: {} })

    await expect(
      createSituationUpdate({
        municipalityId: 'daet',
        municipalityLabel: 'Daet',
        hazardType: 'typhoon',
        condition: 'heavy_rain',
        body: 'Strong rain near the market.',
      }),
    ).rejects.toThrow('invalid server response')
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
    expect(mockOrderBy).toHaveBeenCalledWith('createdAt', 'desc')
    expect(errorSpy).toHaveBeenCalledWith('Skipping invalid situation update document', 'bad')
    expect(onNext).toHaveBeenCalledWith([
      expect.objectContaining({ id: 'new', body: 'Newer update' }),
      expect.objectContaining({ id: 'old', body: 'Older update' }),
    ])
  })
})
