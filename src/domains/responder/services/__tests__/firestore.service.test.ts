/**
 * getAssignedIncidents Tests
 *
 * Verifies that getAssignedIncidents enforces municipality filtering
 * to prevent cross-municipality data leakage (CRITICAL-AUTH-3).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { where, orderBy } from 'firebase/firestore'

// Hoisted mock refs — must be defined before vi.mock()
const getCollectionMock = vi.hoisted(() => vi.fn().mockResolvedValue([]))
const getDocumentMock = vi.hoisted(() => vi.fn())

vi.mock('@/shared/services/firestore.service', () => ({
  getCollection: getCollectionMock,
  getDocument: getDocumentMock,
}))

import { getAssignedIncidents } from '../firestore.service'

describe('getAssignedIncidents', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getCollectionMock.mockResolvedValue([])
    getDocumentMock.mockResolvedValue(null)
  })

  it('should throw if municipality is missing', async () => {
    getCollectionMock.mockResolvedValue([])
    await expect(getAssignedIncidents('responder-uid', '')).rejects.toThrow(
      'municipality is required'
    )
    await expect(getAssignedIncidents('responder-uid', undefined as unknown as string)).rejects.toThrow(
      'municipality is required'
    )
    // Verify getCollection was never called (no downstream Firestore call for invalid input)
    expect(getCollectionMock).not.toHaveBeenCalled()
  })

  it('should query with assignedTo and municipality constraints', async () => {
    getCollectionMock.mockResolvedValue([
      { reportId: 'report-1', assignedTo: 'responder-uid', municipality: 'Daet' },
    ])
    getDocumentMock.mockResolvedValue({ id: 'report-1' })

    await getAssignedIncidents('responder-uid', 'Daet')

    expect(getCollectionMock).toHaveBeenCalledOnce()
    const [collection, constraints] = getCollectionMock.mock.calls[0]

    expect(collection).toBe('report_ops')
    expect(constraints).toContainEqual(where('assignedTo', '==', 'responder-uid'))
    expect(constraints).toContainEqual(where('municipality', '==', 'Daet'))
    expect(constraints).toContainEqual(orderBy('assignedAt', 'desc'))
  })

  it('should return results with both report and ops when municipality matches', async () => {
    const mockOps = { reportId: 'report-1', assignedTo: 'responder-uid', municipality: 'Daet' }
    const mockReport = { id: 'report-1', title: 'Flooding' }
    getCollectionMock.mockResolvedValue([mockOps])
    getDocumentMock.mockResolvedValue(mockReport)

    const results = await getAssignedIncidents('responder-uid', 'Daet')

    expect(results).toHaveLength(1)
    expect(results[0].report).toEqual(mockReport)
    expect(results[0].ops).toEqual(mockOps)
  })

  it('should return empty array when no ops docs match', async () => {
    getCollectionMock.mockResolvedValue([])

    const results = await getAssignedIncidents('responder-uid', 'Daet')
    expect(results).toEqual([])
  })

  it('should filter out results where report is null', async () => {
    getCollectionMock.mockResolvedValue([
      { reportId: 'report-1', assignedTo: 'responder-uid', municipality: 'Daet' },
      { reportId: 'report-deleted', assignedTo: 'responder-uid', municipality: 'Daet' },
    ])
    getDocumentMock
      .mockResolvedValueOnce({ id: 'report-1' })
      .mockResolvedValueOnce(null) // report was deleted

    const results = await getAssignedIncidents('responder-uid', 'Daet')
    expect(results).toHaveLength(1)
    expect(results[0].report.id).toBe('report-1')
  })

  it('should throw wrapped error when getCollection fails', async () => {
    getCollectionMock.mockRejectedValue(new Error('Firestore unavailable'))

    await expect(getAssignedIncidents('responder-uid', 'Daet')).rejects.toThrow(
      'Failed to fetch assigned incidents'
    )
  })
})
