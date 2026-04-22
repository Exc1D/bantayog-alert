import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockDb } = vi.hoisted(() => {
  const store = new Map<string, unknown>()
  const mockDb = {
    getItem: vi.fn((key: string) => Promise.resolve(store.get(key) ?? null)),
    setItem: vi.fn((key: string, value: unknown) => {
      store.set(key, value)
      return Promise.resolve(value)
    }),
    _store: store,
  }
  return { mockDb }
})

vi.mock('localforage', () => ({ default: mockDb }))

import { saveReport, loadReports, updateReportId } from './localForageReports.js'

beforeEach(() => {
  mockDb._store.clear()
  vi.clearAllMocks()
})

describe('loadReports', () => {
  it('returns empty array when nothing stored', async () => {
    expect(await loadReports()).toEqual([])
  })

  it('returns empty array when stored payload is invalid', async () => {
    mockDb._store.set('bantayog:reports:v1', [{ publicRef: 123 }])
    expect(await loadReports()).toEqual([])
  })
})

describe('saveReport', () => {
  it('persists a report to localforage', async () => {
    await saveReport({
      publicRef: 'abcd1234',
      secret: 'sec',
      reportType: 'flood',
      severity: 'high',
      lat: 14.1,
      lng: 122.9,
      submittedAt: 1000,
    })
    const reports = await loadReports()
    expect(reports).toHaveLength(1)
    expect(reports[0]!.publicRef).toBe('abcd1234')
    expect(reports[0]!.severity).toBe('high')
  })

  it('does not duplicate when saving same publicRef twice', async () => {
    await saveReport({
      publicRef: 'abcd1234',
      secret: 'sec',
      reportType: 'flood',
      severity: 'high',
      lat: 14.1,
      lng: 122.9,
      submittedAt: 1000,
    })
    await saveReport({
      publicRef: 'abcd1234',
      secret: 'sec',
      reportType: 'flood',
      severity: 'medium',
      lat: 14.1,
      lng: 122.9,
      submittedAt: 1000,
    })
    const reports = await loadReports()
    expect(reports).toHaveLength(1)
    expect(reports[0]!.severity).toBe('medium')
  })
})

describe('updateReportId', () => {
  it('adds reportId to an existing stored report', async () => {
    await saveReport({
      publicRef: 'abcd1234',
      secret: 'sec',
      reportType: 'flood',
      severity: 'high',
      lat: 14.1,
      lng: 122.9,
      submittedAt: 1000,
    })
    await updateReportId('abcd1234', 'firestore-doc-id-xyz')
    const reports = await loadReports()
    expect(reports[0]!.reportId).toBe('firestore-doc-id-xyz')
  })

  it('is a no-op when publicRef is not found', async () => {
    await updateReportId('unknown', 'some-id')
    expect(await loadReports()).toHaveLength(0)
  })
})
