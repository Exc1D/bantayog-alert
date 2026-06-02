import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ConfirmationModal } from '../components/ConfirmationModal'

describe('ConfirmationModal', () => {
  it('renders when open', () => {
    render(
      <ConfirmationModal
        open
        title="Reject?"
        message="Are you sure?"
        confirmLabel="Reject"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    )
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('renders above map triage panels', () => {
    render(
      <ConfirmationModal
        open
        title="Verify?"
        message="Are you sure?"
        confirmLabel="Verify"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    )
    expect(screen.getByRole('dialog').parentElement).toHaveClass('z-[1100]')
  })

  it('does not render when closed', () => {
    render(
      <ConfirmationModal
        open={false}
        title="Reject?"
        message="Are you sure?"
        confirmLabel="Reject"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    )
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('calls onConfirm when confirm clicked', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    render(
      <ConfirmationModal
        open
        title="Reject?"
        message="Are you sure?"
        confirmLabel="Reject"
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />,
    )
    await user.click(screen.getByRole('button', { name: 'Reject' }))
    expect(onConfirm).toHaveBeenCalled()
  })
})
