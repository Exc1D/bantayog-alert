import '@testing-library/jest-dom/vitest'
import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

const mockSignOut = vi.fn()

beforeAll(() => {
  Object.defineProperty(navigator, 'storage', {
    value: {
      estimate: () => Promise.resolve({ usage: 5 * 1024 * 1024, quota: 100 * 1024 * 1024 }),
    },
    configurable: true,
  })
})

vi.mock('firebase/auth', () => ({
  signOut: (...args: unknown[]) => mockSignOut(...args),
}))

vi.mock('../services/firebase.js', () => ({
  auth: () => ({}),
  hasFirebaseConfig: () => false,
}))

vi.mock('../components/Toggle.js', () => ({
  Toggle: ({ label }: { label: string }) => (
    <div role="switch" aria-label={label} aria-checked="false" />
  ),
}))

vi.mock('../components/DeleteAccountFlow.js', () => ({
  DeleteAccountFlow: () => <div>Delete Account Flow</div>,
}))

vi.mock('../hooks/useToast.js', () => ({
  useToast: () => ({ show: false, message: '', type: 'info' as const, toast: vi.fn() }),
}))

vi.mock('../services/callables.js', () => ({
  requestDataExport: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../components/Toast.js', () => ({
  Toast: () => null,
}))

import { SettingsPage } from './SettingsPage'

describe('SettingsPage', () => {
  it('renders all sections', () => {
    render(
      <MemoryRouter>
        <SettingsPage />
      </MemoryRouter>,
    )
    expect(screen.getByText('Settings')).toBeInTheDocument()
    expect(screen.getByText('Push notifications')).toBeInTheDocument()
    expect(screen.getByText('Alert sounds')).toBeInTheDocument()
    expect(screen.getByText('Auto-detect location')).toBeInTheDocument()
    expect(screen.getByText('Offline-first cache')).toBeInTheDocument()
    // Download my data is gated on authenticated user
    expect(screen.queryByText('Download my data')).not.toBeInTheDocument()
    expect(screen.getByText('Privacy Policy')).toBeInTheDocument()
  })

  it('displays storage info', async () => {
    render(
      <MemoryRouter>
        <SettingsPage />
      </MemoryRouter>,
    )
    await waitFor(() => {
      expect(screen.getByText(/Using \d+\.\d+ MB/)).toBeInTheDocument()
    })
  })
})
