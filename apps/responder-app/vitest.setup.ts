import { vi, beforeEach } from 'vitest'

beforeEach(() => {
  Object.defineProperty(navigator, 'geolocation', {
    value: {
      watchPosition: vi.fn(),
      clearWatch: vi.fn(),
      getCurrentPosition: vi.fn(),
    },
    configurable: true,
  })
})
