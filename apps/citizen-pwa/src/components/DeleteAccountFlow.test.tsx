import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { DeleteAccountFlow } from './DeleteAccountFlow.js'

const { mockErasure } = vi.hoisted(() => ({ mockErasure: vi.fn() }))
vi.mock('../services/erasure.js', () => ({
  requestDataErasureAndSignOut: (): Promise<void> => mockErasure() as Promise<void>,
}))

beforeEach(() => {
  mockErasure.mockReset()
})

describe('DeleteAccountFlow', () => {
  it('renders trigger button', () => {
    render(<DeleteAccountFlow onGoodbye={vi.fn()} />)
    expect(screen.getByRole('button', { name: /delete my account/i })).toBeDefined()
  })

  it('shows step-1 warning modal on trigger click', async () => {
    const user = userEvent.setup()
    render(<DeleteAccountFlow onGoodbye={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: /delete my account/i }))
    expect(screen.getByText(/delete your account/i)).toBeDefined()
    expect(screen.getByRole('button', { name: /yes, delete my account/i })).toBeDefined()
  })

  it('shows step-2 typing gate after step-1 confirmation', async () => {
    const user = userEvent.setup()
    render(<DeleteAccountFlow onGoodbye={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: /delete my account/i }))
    await user.click(screen.getByRole('button', { name: /yes, delete my account/i }))
    expect(screen.getByPlaceholderText(/type delete/i)).toBeDefined()
  })

  it('submit is disabled until user types DELETE', async () => {
    const user = userEvent.setup()
    render(<DeleteAccountFlow onGoodbye={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: /delete my account/i }))
    await user.click(screen.getByRole('button', { name: /yes, delete my account/i }))
    const confirmBtn = screen.getByRole('button', { name: /confirm deletion/i })
    expect(confirmBtn.hasAttribute('disabled')).toBe(true)
    await user.type(screen.getByPlaceholderText(/type delete/i), 'DELETE')
    expect(confirmBtn.hasAttribute('disabled')).toBe(false)
  })

  it('calls erasure service and onGoodbye on successful submission', async () => {
    mockErasure.mockResolvedValueOnce(undefined)
    const onGoodbye = vi.fn()
    const user = userEvent.setup()
    render(<DeleteAccountFlow onGoodbye={onGoodbye} />)
    await user.click(screen.getByRole('button', { name: /delete my account/i }))
    await user.click(screen.getByRole('button', { name: /yes, delete my account/i }))
    await user.type(screen.getByPlaceholderText(/type delete/i), 'DELETE')
    await user.click(screen.getByRole('button', { name: /confirm deletion/i }))
    await waitFor(() => {
      expect(onGoodbye).toHaveBeenCalled()
    })
  })

  it('shows error message on callable failure', async () => {
    mockErasure.mockRejectedValueOnce({ code: 'internal' })
    const user = userEvent.setup()
    render(<DeleteAccountFlow onGoodbye={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: /delete my account/i }))
    await user.click(screen.getByRole('button', { name: /yes, delete my account/i }))
    await user.type(screen.getByPlaceholderText(/type delete/i), 'DELETE')
    await user.click(screen.getByRole('button', { name: /confirm deletion/i }))
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeDefined()
    })
  })

  it('calls onGoodbye when callable returns already-exists', async () => {
    // Service swallows already-exists and resolves so user is signed out
    mockErasure.mockResolvedValueOnce(undefined)
    const onGoodbye = vi.fn()
    const user = userEvent.setup()
    render(<DeleteAccountFlow onGoodbye={onGoodbye} />)
    await user.click(screen.getByRole('button', { name: /delete my account/i }))
    await user.click(screen.getByRole('button', { name: /yes, delete my account/i }))
    await user.type(screen.getByPlaceholderText(/type delete/i), 'DELETE')
    await user.click(screen.getByRole('button', { name: /confirm deletion/i }))
    await waitFor(() => {
      expect(onGoodbye).toHaveBeenCalled()
    })
  })
})
