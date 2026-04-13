import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { ProfileRoute } from '../ProfileRoute'

// Mock both profile components
vi.mock('@/features/profile/components/AnonymousProfile', () => ({
  AnonymousProfile: () => <div data-testid="anonymous-profile">Anonymous</div>,
}))
vi.mock('@/features/profile/components/RegisteredProfile', () => ({
  RegisteredProfile: () => <div data-testid="registered-profile">Registered</div>,
}))

const mockUseAuth = vi.hoisted(() => vi.fn())
vi.mock('@/shared/hooks/useAuth', () => ({ useAuth: mockUseAuth }))

describe('ProfileRoute', () => {
  it('renders AnonymousProfile when there is no authenticated user', () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false })
    render(<ProfileRoute />)
    expect(screen.getByTestId('anonymous-profile')).toBeInTheDocument()
    expect(screen.queryByTestId('registered-profile')).not.toBeInTheDocument()
  })

  it('renders RegisteredProfile when a user is authenticated', () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'u1' }, loading: false })
    render(<ProfileRoute />)
    expect(screen.getByTestId('registered-profile')).toBeInTheDocument()
    expect(screen.queryByTestId('anonymous-profile')).not.toBeInTheDocument()
  })

  it('renders nothing while auth is loading', () => {
    mockUseAuth.mockReturnValue({ user: null, loading: true })
    const { container } = render(<ProfileRoute />)
    expect(container.firstChild).toBeNull()
  })
})
