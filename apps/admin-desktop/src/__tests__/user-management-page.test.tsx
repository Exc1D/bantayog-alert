import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { UserManagementPage } from '../pages/UserManagementPage'

const mockOnSnapshot = vi.fn()

vi.mock('firebase/firestore', () => ({
  collection: vi.fn((_db, path: string) => ({ _collectionPath: path })),
  onSnapshot: (...args: unknown[]) => mockOnSnapshot(...args),
  query: vi.fn((collRef) => collRef),
  orderBy: vi.fn(),
}))

vi.mock('../app/firebase', () => ({ db: {} }))

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const mockSuspendUser = vi.fn((_payload: unknown) =>
  Promise.resolve({ uid: 'user-1', status: 'suspended' }),
)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const mockRevokeUser = vi.fn((_payload: unknown) =>
  Promise.resolve({ uid: 'user-1', status: 'revoked' }),
)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const mockResetUserTotp = vi.fn((_payload: unknown) =>
  Promise.resolve({ uid: 'user-1', reset: true }),
)

vi.mock('../services/callables', () => ({
  callables: {
    suspendUser: (payload: unknown) => mockSuspendUser(payload),
    revokeUser: (payload: unknown) => mockRevokeUser(payload),
    resetUserTotp: (payload: unknown) => mockResetUserTotp(payload),
    approveErasureRequest: vi.fn(() => Promise.resolve({})),
  },
}))

function seedErasureRequests() {
  let callCount = 0
  mockOnSnapshot.mockImplementation((_q, onNext) => {
    callCount++
    if (callCount === 1) {
      onNext({
        docs: [
          {
            id: 'user-1',
            data: () => ({
              displayName: 'Alice',
              email: 'alice@example.com',
              role: 'municipal_admin',
              municipality: 'Daet',
              mfaEnrolled: true,
              lastLogin: { toDate: () => new Date('2026-05-01') },
            }),
          },
        ],
      })
    } else {
      onNext({ docs: [] })
    }
    return vi.fn()
  })
}

describe('UserManagementPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSuspendUser.mockResolvedValue({ uid: 'user-1', status: 'suspended' })
    mockRevokeUser.mockResolvedValue({ uid: 'user-1', status: 'revoked' })
    mockResetUserTotp.mockResolvedValue({ uid: 'user-1', reset: true })
    seedErasureRequests()
    vi.stubGlobal(
      'confirm',
      vi.fn(() => true),
    )
  })

  it('renders user table with action buttons', () => {
    render(<UserManagementPage />)

    expect(screen.getByRole('button', { name: /suspend/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /revoke/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /reset totp/i })).toBeInTheDocument()
  })

  it('calls suspendUser when Suspend is clicked and confirmed', async () => {
    const user = userEvent.setup()
    render(<UserManagementPage />)

    await user.click(screen.getByRole('button', { name: /suspend/i }))

    await waitFor(() => {
      expect(mockSuspendUser).toHaveBeenCalledTimes(1)
    })
    expect(mockSuspendUser).toHaveBeenCalledWith(
      expect.objectContaining({ uid: 'user-1', idempotencyKey: expect.any(String) }),
    )
  })

  it('does not call suspendUser when user cancels confirmation', async () => {
    vi.stubGlobal(
      'confirm',
      vi.fn(() => false),
    )
    const user = userEvent.setup()
    render(<UserManagementPage />)

    await user.click(screen.getByRole('button', { name: /suspend/i }))

    expect(mockSuspendUser).not.toHaveBeenCalled()
  })

  it('calls revokeUser when Revoke is clicked and confirmed', async () => {
    const user = userEvent.setup()
    render(<UserManagementPage />)

    await user.click(screen.getByRole('button', { name: /revoke/i }))

    await waitFor(() => {
      expect(mockRevokeUser).toHaveBeenCalledTimes(1)
    })
    expect(mockRevokeUser).toHaveBeenCalledWith(
      expect.objectContaining({ uid: 'user-1', idempotencyKey: expect.any(String) }),
    )
  })

  it('calls resetUserTotp when Reset TOTP is clicked and confirmed', async () => {
    const user = userEvent.setup()
    render(<UserManagementPage />)

    await user.click(screen.getByRole('button', { name: /reset totp/i }))

    await waitFor(() => {
      expect(mockResetUserTotp).toHaveBeenCalledTimes(1)
    })
    expect(mockResetUserTotp).toHaveBeenCalledWith(
      expect.objectContaining({ uid: 'user-1', idempotencyKey: expect.any(String) }),
    )
  })

  it('disables action buttons while suspend is in progress', async () => {
    let resolveSuspend: (value: { uid: string; status: string }) => void
    mockSuspendUser.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSuspend = resolve
        }),
    )

    const user = userEvent.setup()
    render(<UserManagementPage />)

    await user.click(screen.getByRole('button', { name: /suspend/i }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /suspend/i })).toBeDisabled()
    })
    expect(screen.getByRole('button', { name: /revoke/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /reset totp/i })).toBeDisabled()

    resolveSuspend!({ uid: 'user-1', status: 'suspended' })

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /suspend/i })).not.toBeDisabled()
    })
  })

  it('displays error banner when suspendUser fails', async () => {
    mockSuspendUser.mockRejectedValue(new Error('network error'))

    const user = userEvent.setup()
    render(<UserManagementPage />)

    await user.click(screen.getByRole('button', { name: /suspend/i }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/network error/)
    })
  })

  it('dismisses error banner when Dismiss is clicked', async () => {
    mockSuspendUser.mockRejectedValue(new Error('network error'))

    const user = userEvent.setup()
    render(<UserManagementPage />)

    await user.click(screen.getByRole('button', { name: /suspend/i }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: /dismiss/i }))

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
