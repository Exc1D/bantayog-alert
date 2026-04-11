import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AnonymousProfile } from '../AnonymousProfile'

describe('AnonymousProfile', () => {
  it('renders "Not Signed In" header', () => {
    render(<AnonymousProfile />)

    expect(screen.getByText(/not signed in/i)).toBeInTheDocument()
  })

  it('renders value proposition with "Why create an account?"', () => {
    render(<AnonymousProfile />)

    expect(screen.getByText(/why create an account\?/i)).toBeInTheDocument()
  })

  it('renders "Track your report status" benefit', () => {
    render(<AnonymousProfile />)

    expect(screen.getByText(/track your report status/i)).toBeInTheDocument()
  })

  it('renders "Create Account" button', () => {
    render(<AnonymousProfile />)

    expect(
      screen.getByRole('button', { name: /create account/i })
    ).toBeInTheDocument()
  })

  it('renders "Continue as Anonymous" button', () => {
    render(<AnonymousProfile />)

    expect(
      screen.getByRole('button', { name: /continue as anonymous/i })
    ).toBeInTheDocument()
  })

  it('renders admin contact section', () => {
    render(<AnonymousProfile />)

    expect(screen.getByText(/contact your admin/i)).toBeInTheDocument()
  })
})
