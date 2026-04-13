import { describe, it, expect, vi } from 'vitest'
import { submitCitizenReport } from '../reportSubmission.service'

const submitReportMock = vi.hoisted(() => vi.fn().mockResolvedValue('report-123'))
const uploadReportPhotoMock = vi.hoisted(() => vi.fn().mockResolvedValue('https://example.com/photo.jpg'))

vi.mock('@/domains/citizen/services/firestore.service', () => ({
  submitReport: submitReportMock,
}))

vi.mock('../reportStorage.service', () => ({
  uploadReportPhoto: uploadReportPhotoMock,
}))

describe('submitCitizenReport', () => {
  beforeEach(() => {
    submitReportMock.mockClear()
    submitReportMock.mockResolvedValue('report-123')
    uploadReportPhotoMock.mockClear()
    uploadReportPhotoMock.mockResolvedValue('https://example.com/photo.jpg')
  })

  it('persists an online report and returns the real report id', async () => {
    const result = await submitCitizenReport({
      incidentType: 'flood',
      photo: new File(['x'], 'photo.jpg', { type: 'image/jpeg' }),
      location: { type: 'manual', municipality: 'Daet', barangay: 'Bagasbas' },
      phone: '+63 912 345 6789',
      isAnonymous: false,
    })

    expect(result.reportId).toBe('report-123')
    expect(result.photoUrls).toEqual(['https://example.com/photo.jpg'])
  })

  it('works without a photo', async () => {
    const result = await submitCitizenReport({
      incidentType: 'flood',
      photo: null,
      location: { type: 'manual', municipality: 'Daet', barangay: 'Bagasbas' },
      phone: '+63 912 345 6789',
      isAnonymous: false,
    })

    expect(result.reportId).toBe('report-123')
    expect(result.photoUrls).toEqual([])
  })

  it('passes correct report data to submitReport', async () => {
    await submitCitizenReport({
      incidentType: 'flood',
      photo: null,
      location: { type: 'manual', municipality: 'Daet', barangay: 'Bagasbas' },
      phone: '+63 912 345 6789',
      isAnonymous: false,
    })

    expect(submitReportMock).toHaveBeenCalledOnce()
    expect(submitReportMock.mock.calls[0][0]).toMatchObject({
      incidentType: 'flood',
      isAnonymous: false,
      approximateLocation: expect.objectContaining({
        municipality: 'Daet',
        barangay: 'Bagasbas',
      }),
    })
    expect(submitReportMock.mock.calls[0][1]).toMatchObject({
      exactLocation: expect.objectContaining({
        address: 'Bagasbas, Daet',
      }),
      reporterContact: { phone: '+63 912 345 6789' },
    })
  })
})