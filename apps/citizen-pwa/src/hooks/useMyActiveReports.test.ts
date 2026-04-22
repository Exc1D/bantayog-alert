import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'

const { mockLoadReports, mockUpdateReportId } = vi.hoisted(() => ({
  mockLoadReports: vi.fn(),
  mockUpdateReportId: vi.fn(),
}))

vi.mock('../services/localForageReports.js', () => ({
  loadReports: mockLoadReports,
  updateReportId: mockUpdateReportId,
}))

const { mockGetDoc, mockDoc } = vi.hoisted(() => ({
  mockGetDoc: vi.fn(),
  mockDoc: vi.fn((_, collection: string, id: string) => `${collection}/${id}`),
}))

vi.mock('firebase/firestore', () => ({
  getDoc: mockGetDoc,
  doc: mockDoc,
}))

const { mockRequestLookup, mockFns } = vi.hoisted(() => ({
  mockRequestLookup: vi.fn(),
  mockFns: vi.fn().mockReturnValue({}),
}))

vi.mock('firebase/functions', () => ({
  httpsCallable: vi.fn(() => mockRequestLookup),
}))

vi.mock('../services/firebase.js', () => ({
  db: vi.fn().mockReturnValue({}),
  fns: mockFns,
}))

import { useMyActiveReports } from './useMyActiveReports.js'

beforeEach(() => {
  vi.clearAllMocks()
  mockUpdateReportId.mockResolvedValue(undefined)
})

describe('useMyActiveReports', () => {
  it('returns empty array when localForage is empty', async () => {
    mockLoadReports.mockResolvedValue([])
    const { result } = renderHook(() => useMyActiveReports())
    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })
    expect(result.current.reports).toEqual([])
  })

  it('fetches status and reportId for each stored report', async () => {
    mockLoadReports.mockResolvedValue([
      {
        publicRef: 'abcd1234',
        secret: 'sec',
        reportType: 'flood',
        severity: 'high',
        lat: 14.1,
        lng: 122.9,
        submittedAt: 1000,
      },
    ])
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({ reportId: 'firestore-id-1' }),
    })
    mockRequestLookup.mockResolvedValue({
      data: { status: 'verified', lastStatusAt: 2000, municipalityLabel: 'Daet' },
    })
    const { result } = renderHook(() => useMyActiveReports())
    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })
    expect(result.current.reports).toHaveLength(1)
    expect(result.current.reports[0]!.status).toBe('verified')
    expect(result.current.reports[0]!.id).toBe('firestore-id-1')
    expect(result.current.reports[0]!.municipalityLabel).toBe('Daet')
  })

  it('sets status to queued when requestLookup throws NOT_FOUND', async () => {
    mockLoadReports.mockResolvedValue([
      {
        publicRef: 'newref1',
        secret: 'sec',
        reportType: 'fire',
        severity: 'medium',
        lat: 14.0,
        lng: 122.8,
        submittedAt: 500,
      },
    ])
    mockGetDoc.mockResolvedValue({ exists: () => false, data: () => null })
    mockRequestLookup.mockRejectedValue({ code: 'not-found' })
    const { result } = renderHook(() => useMyActiveReports())
    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })
    expect(result.current.reports[0]!.status).toBe('queued')
    expect(result.current.reports[0]!.id).toBeUndefined()
  })

  it('caches reportId to localForage when newly fetched', async () => {
    mockLoadReports.mockResolvedValue([
      {
        publicRef: 'abcd1234',
        secret: 'sec',
        reportType: 'flood',
        severity: 'high',
        lat: 14.1,
        lng: 122.9,
        submittedAt: 1000,
      },
    ])
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({ reportId: 'firestore-id-1' }),
    })
    mockRequestLookup.mockResolvedValue({
      data: { status: 'new', lastStatusAt: 1001, municipalityLabel: 'Daet' },
    })
    const { result } = renderHook(() => useMyActiveReports())
    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })
    expect(mockUpdateReportId).toHaveBeenCalledWith('abcd1234', 'firestore-id-1')
  })
})
