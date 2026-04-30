/* eslint-disable @typescript-eslint/no-unsafe-return */
import '@testing-library/jest-dom/vitest'
import { describe, it, expect, vi } from 'vitest'

const mockHttpsCallable = vi.fn()

vi.mock('firebase/functions', () => ({
  httpsCallable: (...args: unknown[]) => mockHttpsCallable(...args),
}))

vi.mock('./firebase.js', () => ({
  fns: () => 'mocked-functions',
}))

import { requestDataExport } from './callables'

describe('callables', () => {
  it('requestDataExport calls correct callable', async () => {
    const mockCall = vi.fn().mockResolvedValue({})
    mockHttpsCallable.mockReturnValue(mockCall)
    await requestDataExport()
    expect(mockHttpsCallable).toHaveBeenCalledWith('mocked-functions', 'requestDataExport')
    expect(mockCall).toHaveBeenCalled()
  })
})
