/**
 * RateLimitExceeded Component Tests
 *
 * Tests the rate limit exceeded screen displayed when user has exceeded
 * the report submission rate limit. Verifies MDRRMO hotline contact,
 * retry countdown, and dismiss functionality.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RateLimitExceeded } from '../RateLimitExceeded'

describe('RateLimitExceeded', () => {
  it('should display rate limit message', () => {
    render(<RateLimitExceeded />)

    expect(screen.getByText(/reached the reporting limit/i)).toBeInTheDocument()
  })

  it('should show MDRRMO hotline number', () => {
    render(<RateLimitExceeded mdrmoHotline="+63 123 456 7890" />)

    // The hotline number should be visible
    expect(screen.getByText(/\+63 123 456 7890/)).toBeInTheDocument()
    // Should show link with call functionality
    const callLink = screen.getByRole('link')
    expect(callLink).toHaveAttribute('href', 'tel:+631234567890')
  })

  it('should have clickable call button', () => {
    render(<RateLimitExceeded mdrmoHotline="+63 123 456 7890" />)

    const callLink = screen.getByRole('link')
    expect(callLink).toHaveAttribute('href', 'tel:+631234567890')
  })

  it('should show retry time if provided', () => {
    render(<RateLimitExceeded retryAfterMinutes={30} />)

    expect(screen.getByText(/try again in 30 minutes/i)).toBeInTheDocument()
  })

  it('should have ok button to dismiss', async () => {
    const onOk = vi.fn()
    render(<RateLimitExceeded onOk={onOk} />)

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /ok/i }))
    expect(onOk).toHaveBeenCalledTimes(1)
  })
})
