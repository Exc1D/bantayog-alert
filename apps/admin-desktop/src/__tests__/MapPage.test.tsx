import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import MapPage from '../pages/MapPage'

vi.mock('../hooks/useFirestoreListeners', () => ({
  useFirestoreListeners: () => ({
    loading: false,
    error: null,
    reports: [],
    reportOps: [],
    alerts: [],
    responders: [],
  }),
}))

vi.mock('../providers/WindowSyncProvider', () => ({
  useWindowSyncContext: () => ({
    sendSync: vi.fn(),
    subscribe: vi.fn().mockReturnValue(() => {
      /* unsubscribe */
    }),
  }),
}))

describe('MapPage', () => {
  it('renders header and map', () => {
    render(<MapPage />)
    expect(screen.getByText('Provincial Map — Camarines Norte')).toBeInTheDocument()
  })
})
