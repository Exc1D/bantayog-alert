import '@testing-library/jest-dom/vitest'
import { describe, it, expect, vi } from 'vitest'

const mockHttpsCallable = vi.fn()

vi.mock('firebase/functions', () => ({
  httpsCallable: (...args: unknown[]) => mockHttpsCallable(...args),
}))

vi.mock('./firebase.js', () => ({
  fns: () => 'mocked-functions',
}))

import { requestDataExport, registerCitizen } from './callables'

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
