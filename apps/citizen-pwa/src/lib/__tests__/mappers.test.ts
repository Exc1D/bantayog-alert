import { describe, it, expect } from 'vitest'
import { mapReportFromFirestore } from '../mappers'

const minimal = {
  id: 'r1',
  status: 'new',
  timeline: [{ event: 'created', timestamp: 1000 }],
}

describe('mapReportFromFirestore', () => {
  it('maps minimal valid data', () => {
    const result = mapReportFromFirestore(minimal)
    expect(result.id).toBe('r1')
    expect(result.status).toBe('new')
    expect(result.timeline).toEqual([{ event: 'created', timestamp: 1000 }])
  })

  it('maps all optional fields when present', () => {
    const data = {
      ...minimal,
      type: 'flood',
      reportType: 'incident',
      severity: 'high',
      createdAt: 1000,
      updatedAt: 2000,
      reporterName: 'Juan',
      reporterPhone: '09171234567',
      resolutionNote: 'resolved',
      closedBy: 'admin',
      location: { address: '123 St', lat: 14.5, lng: 121.0 },
    }
    const result = mapReportFromFirestore(data)
    expect(result.type).toBe('flood')
    expect(result.reportType).toBe('incident')
    expect(result.severity).toBe('high')
    expect(result.createdAt).toBe(1000)
    expect(result.updatedAt).toBe(2000)
    expect(result.reporterName).toBe('Juan')
    expect(result.reporterPhone).toBe('09171234567')
    expect(result.resolutionNote).toBe('resolved')
    expect(result.closedBy).toBe('admin')
    expect(result.location).toEqual({ address: '123 St', lat: 14.5, lng: 121.0 })
  })

  it('throws when id is missing', () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id: _id, ...noId } = minimal
    expect(() => mapReportFromFirestore(noId)).toThrow('missing required fields')
  })

  it('throws when status is missing', () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { status: _status, ...noStatus } = minimal
    expect(() => mapReportFromFirestore(noStatus)).toThrow('missing required fields')
  })

  it('throws when timeline is not an array', () => {
    expect(() =>
      mapReportFromFirestore({ id: 'r1', status: 'new', timeline: 'bad' }),
    ).toThrow('missing required fields')
  })

  it('throws when timeline event is not an object', () => {
    expect(() =>
      mapReportFromFirestore({ id: 'r1', status: 'new', timeline: ['bad'] }),
    ).toThrow('Invalid timeline event at index 0')
  })

  it('throws when timeline event has non-string event field', () => {
    expect(() =>
      mapReportFromFirestore({
        id: 'r1',
        status: 'new',
        timeline: [{ event: 123, timestamp: 1000 }],
      }),
    ).toThrow('Invalid timeline event fields at index 0')
  })

  it('throws when timeline event has non-number timestamp', () => {
    expect(() =>
      mapReportFromFirestore({
        id: 'r1',
        status: 'new',
        timeline: [{ event: 'created', timestamp: 'bad' }],
      }),
    ).toThrow('Invalid timeline event fields at index 0')
  })

  it('includes actor and note when present in timeline event', () => {
    const result = mapReportFromFirestore({
      ...minimal,
      timeline: [{ event: 'created', timestamp: 1000, actor: 'admin', note: 'ok' }],
    })
    expect(result.timeline[0]!.actor).toBe('admin')
    expect(result.timeline[0]!.note).toBe('ok')
  })

  it('omits actor and note when not strings', () => {
    const result = mapReportFromFirestore({
      ...minimal,
      timeline: [{ event: 'created', timestamp: 1000, actor: 123, note: null }],
    })
    expect(result.timeline[0]).not.toHaveProperty('actor')
    expect(result.timeline[0]).not.toHaveProperty('note')
  })

  it('handles null location gracefully (returns undefined)', () => {
    const result = mapReportFromFirestore({ ...minimal, location: null })
    expect(result.location).toBeUndefined()
  })

  it('handles location with partial fields', () => {
    const result = mapReportFromFirestore({
      ...minimal,
      location: { lat: 14.5 },
    })
    expect(result.location).toEqual({ lat: 14.5 })
    expect(result.location).not.toHaveProperty('address')
    expect(result.location).not.toHaveProperty('lng')
  })
})
