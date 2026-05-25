import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SkipLink } from '../components/SkipLink'

describe('SkipLink', () => {
  it('is visually hidden by default (has sr-only class)', () => {
    render(<SkipLink />)
    const link = screen.getByText('Skip to main content')
    expect(link).toHaveClass('sr-only')
  })

  it('becomes visible on focus (does not have sr-only when focused)', () => {
    render(<SkipLink />)
    const link = screen.getByText('Skip to main content')
    expect(link.className).toContain('focus:not-sr-only')
  })

  it('links to #main-content', () => {
    render(<SkipLink />)
    const link = screen.getByText('Skip to main content')
    expect(link).toHaveAttribute('href', '#main-content')
  })
})
