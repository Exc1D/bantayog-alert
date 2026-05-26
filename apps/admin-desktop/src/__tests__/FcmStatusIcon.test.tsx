import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { FcmStatusIcon } from '../components/FcmStatusIcon'

describe('FcmStatusIcon', () => {
  it('renders success-colored CheckCircle for sent', () => {
    render(<FcmStatusIcon result="sent" />)
    const icon = screen.getByLabelText('FCM delivered to device')
    expect(icon).toBeInTheDocument()
    expect(icon).toHaveClass('text-[var(--color-success)]')
  })

  it('renders danger-colored XCircle for network_error', () => {
    render(<FcmStatusIcon result="network_error" />)
    const icon = screen.getByLabelText('FCM network error')
    expect(icon).toBeInTheDocument()
    expect(icon).toHaveClass('text-[var(--color-danger)]')
  })

  it('renders warning-colored AlertCircle for no_token', () => {
    render(<FcmStatusIcon result="no_token" />)
    const icon = screen.getByLabelText('No FCM token')
    expect(icon).toBeInTheDocument()
    expect(icon).toHaveClass('text-[var(--color-warning)]')
  })

  it('renders muted HelpCircle for null result', () => {
    render(<FcmStatusIcon result={null} />)
    const icon = screen.getByLabelText('FCM status unknown')
    expect(icon).toBeInTheDocument()
    expect(icon).toHaveClass('text-[var(--color-text-muted)]')
  })

  it('renders muted HelpCircle for unknown result', () => {
    render(<FcmStatusIcon result="some_unexpected_value" />)
    const icon = screen.getByLabelText('FCM status unknown')
    expect(icon).toBeInTheDocument()
    expect(icon).toHaveClass('text-[var(--color-text-muted)]')
  })
})
