import { describe, it, expect, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'

const mockOnSnapshot = vi.hoisted(() => vi.fn())

vi.mock('../app/firebase', () => ({ db: {} }))
vi.mock('firebase/firestore', () => ({
  doc: vi.fn((_db, _col, id: string) => ({ id })),
  onSnapshot: mockOnSnapshot,
}))

import { useReport } from './useReport'

describe('useReport', () => {
  it('returns report data when snapshot exists', async () => {
    mockOnSnapshot.mockImplementationOnce(
      (_ref: unknown, onNext: (snap: { exists: () => boolean; data: () => unknown }) => void) => {
        onNext({
          exists: () => true,
          data: () => ({
            reportType: 'flood',
            severity: 'high',
            status: 'verified',
            description: 'Rising water near bridge',
            municipalityId: 'daet',
            municipalityLabel: 'Daet',
            source: 'web',
            visibilityClass: 'public_alertable',
            submittedAt: { toMillis: () => 1700000000000 },
          }),
        })
        return () => undefined
      },
    )

    const { result } = renderHook(() => useReport('report-1'))

    await waitFor(() => {
      expect(result.current.report).not.toBeNull()
      expect(result.current.report?.reportType).toBe('flood')
      expect(result.current.report?.severity).toBe('high')
    })
  })

  it('returns null when reportId is undefined', async () => {
    const { result } = renderHook(() => useReport(undefined))
    await waitFor(() => {
      expect(result.current.loading).toBe(false)
      expect(result.current.report).toBeNull()
    })
  })

  it('normalizes unknown severity values to "low" instead of leaking raw strings', async () => {
    mockOnSnapshot.mockImplementationOnce(
      (_ref: unknown, onNext: (snap: { exists: () => boolean; data: () => unknown }) => void) => {
        onNext({
          exists: () => true,
          data: () => ({
            reportType: 'flood',
            severity: 'critical', // not in the responder UI allowlist
            status: 'verified',
            description: '',
            municipalityId: 'daet',
            source: 'web',
            submittedAt: { toMillis: () => 1700000000000 },
          }),
        })
        return () => undefined
      },
    )

    const { result } = renderHook(() => useReport('report-with-bad-severity'))

    await waitFor(() => {
      expect(result.current.report?.severity).toBe('low')
    })
  })

  it('accepts canonical publicLocation lat/lng shape', async () => {
    mockOnSnapshot.mockImplementationOnce(
      (_ref: unknown, onNext: (snap: { exists: () => boolean; data: () => unknown }) => void) => {
        onNext({
          exists: () => true,
          data: () => ({
            reportType: 'flood',
            severity: 'high',
            status: 'verified',
            description: 'Rising water near bridge',
            municipalityId: 'daet',
            source: 'web',
            submittedAt: { toMillis: () => 1700000000000 },
            publicLocation: { lat: 14.112, lng: 122.955 },
          }),
        })
        return () => undefined
      },
    )

    const { result } = renderHook(() => useReport('report-with-lat-lng'))

    await waitFor(() => {
      expect(result.current.report?.publicLocation).toEqual({
        latitude: 14.112,
        longitude: 122.955,
      })
    })
  })
})
