import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'
import { act, render } from '@testing-library/react'
import { App } from './App.js'

const mockFetch = vi.fn()

beforeEach(() => {
  mockFetch.mockResolvedValue(new Response('ok'))
  vi.stubGlobal('fetch', mockFetch)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

describe('App', () => {
  it('renders without throwing', async () => {
    expect(() => render(<App />)).not.toThrow()
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
  })
})
