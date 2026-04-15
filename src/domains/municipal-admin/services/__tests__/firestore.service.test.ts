import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getMunicipalityReports } from '../firestore.service'
import * as firestoreSvc from '@/shared/services/firestore.service'

// Mock firebase/firestore first to prevent firebase/auth initialization
// Use vi.hoisted so the mock references are stable before hoisting
const whereMock = vi.hoisted(() => vi.fn().mockReturnValue({ fieldPath: 'location.municipality' }))
const orderByMock = vi.hoisted(() => vi.fn().mockReturnValue({ fieldPath: 'createdAt' }))
const limitMock = vi.hoisted(() => vi.fn().mockReturnValue({ fieldPath: 'limit' }))

vi.mock('firebase/firestore', () => ({
  where: whereMock,
  orderBy: orderByMock,
  limit: limitMock,
}))

vi.mock('@/app/firebase/config', () => ({
  db: {},
  auth: {},
}))

vi.mock('@/shared/services/firestore.service')

describe('getMunicipalityReports', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset mock return values to return proper constraint objects
    whereMock.mockReturnValue({ fieldPath: 'location.municipality' })
    orderByMock.mockReturnValue({ fieldPath: 'createdAt' })
    limitMock.mockReturnValue({ fieldPath: 'limit' })
  })

  it('passes municipality filter to Firestore query', async () => {
    const getCollectionSpy = vi.spyOn(firestoreSvc, 'getCollection').mockResolvedValue([])
    vi.spyOn(firestoreSvc, 'getDocument').mockResolvedValue(null)

    await getMunicipalityReports('Daet')

    const constraints = getCollectionSpy.mock.calls[0][1]
    // Check that at least one constraint is a where clause on location.municipality
    const hasMunicipalityFilter = constraints?.some((c: any) => {
      return c?.fieldPath === 'location.municipality'
    })
    expect(hasMunicipalityFilter).toBe(true)
  })
})
