import '@testing-library/jest-dom/vitest'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Toast } from './Toast'

vi.mock('../hooks/useReducedMotion', () => ({
  useReducedMotion: () => false,
}))

describe('Toast', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  it('renders message when show is true', () => {
    render(<Toast show={true} message="Saved!" type="success" />)
    expect(screen.getByText('Saved!')).toBeInTheDocument()
  })

  it('does not render when show is false', () => {
    render(<Toast show={false} message="Saved!" type="success" />)
    expect(screen.queryByText('Saved!')).not.toBeInTheDocument()
  })

  it('has correct role', () => {
    render(<Toast show={true} message="Test" type="info" />)
    expect(screen.getByRole('status')).toBeInTheDocument()
  })
})
