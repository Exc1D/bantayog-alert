/* eslint-disable @typescript-eslint/no-empty-function */
import '@testing-library/jest-dom/vitest'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Toggle } from './Toggle'

vi.mock('../hooks/useReducedMotion', () => ({
  useReducedMotion: () => false,
}))

describe('Toggle', () => {
  it('renders with label', () => {
    render(<Toggle checked={false} onChange={() => {}} label="Test toggle" />)
    expect(screen.getByRole('switch', { name: 'Test toggle' })).toBeInTheDocument()
  })

  it('reflects checked state via aria-checked', () => {
    const { rerender } = render(<Toggle checked={false} onChange={() => {}} label="Test" />)
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'false')

    rerender(<Toggle checked={true} onChange={() => {}} label="Test" />)
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true')
  })

  it('toggles on click', () => {
    const onChange = vi.fn()
    render(<Toggle checked={false} onChange={onChange} label="Test" />)
    fireEvent.click(screen.getByRole('switch'))
    expect(onChange).toHaveBeenCalledWith(true)
  })

  it('toggles on Space key', () => {
    const onChange = vi.fn()
    render(<Toggle checked={true} onChange={onChange} label="Test" />)
    fireEvent.keyDown(screen.getByRole('switch'), { key: ' ' })
    expect(onChange).toHaveBeenCalledWith(false)
  })

  it('toggles on Enter key', () => {
    const onChange = vi.fn()
    render(<Toggle checked={false} onChange={onChange} label="Test" />)
    fireEvent.keyDown(screen.getByRole('switch'), { key: 'Enter' })
    expect(onChange).toHaveBeenCalledWith(true)
  })

  it('does not toggle when disabled', () => {
    const onChange = vi.fn()
    render(<Toggle checked={false} onChange={onChange} label="Test" disabled />)
    fireEvent.click(screen.getByRole('switch'))
    expect(onChange).not.toHaveBeenCalled()
  })
})
