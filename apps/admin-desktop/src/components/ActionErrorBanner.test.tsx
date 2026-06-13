import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ActionErrorBanner } from './ActionErrorBanner'

describe('ActionErrorBanner', () => {
  it('renders retry when a retry callback is provided', async () => {
    const user = userEvent.setup()
    const onRetry = vi.fn()

    render(<ActionErrorBanner message="Command failed" onDismiss={vi.fn()} onRetry={onRetry} />)

    await user.click(screen.getByRole('button', { name: 'Retry command' }))

    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('hides retry when no retry callback is provided', () => {
    render(<ActionErrorBanner message="Command failed" onDismiss={vi.fn()} />)

    expect(screen.queryByRole('button', { name: 'Retry command' })).not.toBeInTheDocument()
  })

  it('disables retry while a retry is running', () => {
    render(
      <ActionErrorBanner message="Command failed" onDismiss={vi.fn()} onRetry={vi.fn()} retrying />,
    )

    expect(screen.getByRole('button', { name: 'Retrying command' })).toBeDisabled()
  })
})
