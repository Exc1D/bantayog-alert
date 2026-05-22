import '@testing-library/jest-dom/vitest'
import { describe, it, expect, vi } from 'vitest'

const mockHttpsCallable = vi.fn()

vi.mock('firebase/functions', () => ({
  httpsCallable: (...args: unknown[]) => mockHttpsCallable(...args),
}))

vi.mock('./firebase.js', () => ({
  fns: () => 'mocked-functions',
}))

import { requestDataExport, registerCitizen, submitCitizenReport } from './callables'

describe('callables', () => {
  it('requestDataExport calls correct callable', async () => {
    const mockCall = vi.fn().mockResolvedValue({
      data: {
        downloadUrl: 'https://example.com/export.json',
        expiresAt: 1234567890,
        reportCount: 5,
        mediaCount: 3,
      },
    })
    mockHttpsCallable.mockReturnValue(mockCall)
    const result = await requestDataExport()
    expect(mockHttpsCallable).toHaveBeenCalledWith('mocked-functions', 'requestDataExport')
    expect(mockCall).toHaveBeenCalled()
    expect(result).toEqual({
      downloadUrl: 'https://example.com/export.json',
      expiresAt: 1234567890,
      reportCount: 5,
      mediaCount: 3,
    })
  })

  it('throws on invalid server response from requestDataExport', async () => {
    const mockCall = vi.fn().mockResolvedValue({
      data: { downloadUrl: null, expiresAt: 'not-a-number' },
    })
    mockHttpsCallable.mockReturnValue(mockCall)
    await expect(requestDataExport()).rejects.toThrow('invalid server response')
    expect(mockHttpsCallable).toHaveBeenCalledWith('mocked-functions', 'requestDataExport')
    expect(mockCall).toHaveBeenCalled()
  })
})

describe('registerCitizen', () => {
  it('calls registerCitizen callable and returns uid, role, accountStatus', async () => {
    const mockCall = vi.fn().mockResolvedValue({
      data: { uid: 'user-1', role: 'citizen', accountStatus: 'active' },
    })
    mockHttpsCallable.mockReturnValue(mockCall)
    const result = await registerCitizen()
    expect(mockHttpsCallable).toHaveBeenCalledWith('mocked-functions', 'registerCitizen')
    expect(result).toEqual({ uid: 'user-1', role: 'citizen', accountStatus: 'active' })
  })

  it('throws on invalid server response (missing fields)', async () => {
    const mockCall = vi.fn().mockResolvedValue({ data: { uid: 123 } })
    mockHttpsCallable.mockReturnValue(mockCall)
    await expect(registerCitizen()).rejects.toThrow('invalid server response')
  })

  it('wraps server error with cause', async () => {
    const mockCall = vi.fn().mockRejectedValue(new Error('unavailable'))
    mockHttpsCallable.mockReturnValue(mockCall)
    await expect(registerCitizen()).rejects.toThrow('Citizen registration failed')
  })
})

describe('submitCitizenReport', () => {
  it('calls submitCitizenReport callable and validates the materialization response', async () => {
    const mockCall = vi.fn().mockResolvedValue({
      data: {
        reportId: 'report-1',
        publicRef: 'abcd1234',
        materialized: true,
        replayed: false,
      },
    })
    mockHttpsCallable.mockReturnValue(mockCall)

    const result = await submitCitizenReport({
      clientCreatedAt: 1713350400000,
      idempotencyKey: 'idem-1',
      publicRef: 'abcd1234',
      secretHash: 'a'.repeat(64),
      correlationId: '11111111-1111-4111-8111-111111111111',
      payload: {
        reportType: 'flood',
        description: 'Water rising',
        severity: 'high',
        source: 'web',
        publicLocation: { lat: 14.1, lng: 122.9 },
      },
    })

    expect(mockHttpsCallable).toHaveBeenCalledWith('mocked-functions', 'submitCitizenReport')
    expect(mockCall).toHaveBeenCalledWith({
      clientCreatedAt: 1713350400000,
      idempotencyKey: 'idem-1',
      publicRef: 'abcd1234',
      secretHash: 'a'.repeat(64),
      correlationId: '11111111-1111-4111-8111-111111111111',
      payload: {
        reportType: 'flood',
        description: 'Water rising',
        severity: 'high',
        source: 'web',
        publicLocation: { lat: 14.1, lng: 122.9 },
      },
    })
    expect(result).toEqual({
      reportId: 'report-1',
      publicRef: 'abcd1234',
      materialized: true,
      replayed: false,
    })
  })

  it('throws on invalid submitCitizenReport server response', async () => {
    const mockCall = vi.fn().mockResolvedValue({ data: { publicRef: 'abcd1234' } })
    mockHttpsCallable.mockReturnValue(mockCall)

    await expect(
      submitCitizenReport({
        clientCreatedAt: 1713350400000,
        idempotencyKey: 'idem-1',
        publicRef: 'abcd1234',
        secretHash: 'a'.repeat(64),
        correlationId: '11111111-1111-4111-8111-111111111111',
        payload: {
          reportType: 'flood',
          description: 'Water rising',
          severity: 'high',
          source: 'web',
          publicLocation: { lat: 14.1, lng: 122.9 },
        },
      }),
    ).rejects.toThrow('invalid server response')
  })
})
