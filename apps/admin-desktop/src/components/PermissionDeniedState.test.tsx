import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PermissionDeniedState } from './PermissionDeniedState'

describe('PermissionDeniedState', () => {
  it('renders access guidance without raw error text', () => {
    render(<PermissionDeniedState onSignOut={vi.fn()} />)

    expect(
      screen.getByRole('heading', { name: "You don't have access to this data" }),
    ).toBeInTheDocument()
    expect(screen.getByText(/your role or area assignment may have changed/i)).toBeInTheDocument()
    expect(screen.queryByText('unauthorized')).not.toBeInTheDocument()
  })

  it('offers sign out so the operator can re-authenticate', async () => {
    const user = userEvent.setup()
    const onSignOut = vi.fn()
    render(<PermissionDeniedState onSignOut={onSignOut} />)

    await user.click(screen.getByRole('button', { name: 'Sign out and sign back in' }))

    expect(onSignOut).toHaveBeenCalledTimes(1)
  })
})
