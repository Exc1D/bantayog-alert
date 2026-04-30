import '@testing-library/jest-dom/vitest'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('../services/firebase.js', () => ({
  fns: () => ({}),
  hasFirebaseConfig: () => false,
  FIREBASE_ENV_ERROR_MESSAGE: 'Firebase not configured',
}))

vi.mock('../hooks/useReducedMotion.js', () => ({
  useReducedMotion: () => false,
}))

vi.mock('firebase/functions', () => ({
  httpsCallable: () => () =>
    Promise.resolve({
      data: { status: 'new', lastStatusAt: Date.now(), municipalityLabel: 'Daet' },
    }),
}))

import { LookupScreen } from './LookupScreen'

describe('LookupScreen', () => {
  it('renders input and button', () => {
    render(<LookupScreen />)
    expect(screen.getByPlaceholderText('BA-2026-XXXXX')).toBeInTheDocument()
    expect(screen.getByText('Look Up')).toBeInTheDocument()
  })

  it('shows navy header', () => {
    render(<LookupScreen />)
    expect(screen.getByText('Check Report Status')).toBeInTheDocument()
  })
})
