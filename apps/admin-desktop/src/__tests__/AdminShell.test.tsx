import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockSignOut = vi.hoisted(() => vi.fn())
const signalState = vi.hoisted(() => ({
  audioEnabled: true,
  notificationCount: 1,
  toggleAudio: vi.fn(),
  triageDecisionCount: 2,
}))

vi.mock('@bantayog/shared-ui', () => ({
  useAuth: () => ({ claims: null, signOut: mockSignOut }),
}))

vi.mock('../hooks/useNewReportSignal', () => ({
  useNewReportSignal: () => signalState,
}))

vi.mock('../components/DeclareAlertModal', () => ({
  DeclareAlertModal: ({ open, onError }: { open: boolean; onError: (message: string) => void }) =>
    open ? (
      <button
        type="button"
        onClick={() => {
          onError('Alert broadcast failed')
        }}
      >
        force-alert-error
      </button>
    ) : null,
}))

vi.mock('../app/firebase', () => ({ db: {} }))

import { AdminShell } from '../components/AdminShell'

function renderShell(path = '/triage') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<AdminShell />}>
          <Route path="/dashboard" element={<div>Dashboard content</div>} />
          <Route path="/triage" element={<div>Triage content</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

describe('AdminShell', () => {
  beforeEach(() => {
    localStorage.clear()
    mockSignOut.mockClear()
    signalState.toggleAudio.mockClear()
  })

  it('renders sidebar navigation with the triage decision count', () => {
    renderShell()

    expect(screen.getByRole('link', { name: /triage/i })).toHaveAttribute('href', '/triage')
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('Triage content')).toBeInTheDocument()
  })

  it('persists the collapsed sidebar choice', () => {
    const { unmount } = renderShell()

    fireEvent.click(screen.getByRole('button', { name: /collapse sidebar/i }))
    expect(localStorage.getItem('bantayog:admin-sidebar-collapsed')).toBe('true')

    unmount()
    renderShell()

    expect(screen.getByTestId('admin-sidebar')).toHaveClass('w-16')
    expect(screen.getByRole('button', { name: /expand sidebar/i })).toBeInTheDocument()
  })

  it('surfaces sign-out errors in the shell banner', async () => {
    mockSignOut.mockRejectedValueOnce(new Error('Network error during sign out'))
    renderShell()

    fireEvent.click(screen.getByLabelText('Account menu'))
    fireEvent.click(screen.getByRole('button', { name: /sign out/i }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/Network error during sign out/)
    })
  })

  it('surfaces global alert declaration errors in the shell banner', async () => {
    renderShell()

    fireEvent.click(screen.getByRole('button', { name: /declare alert/i }))
    fireEvent.click(screen.getByText('force-alert-error'))

    expect(await screen.findByText('Alert broadcast failed')).toBeInTheDocument()
  })
})
