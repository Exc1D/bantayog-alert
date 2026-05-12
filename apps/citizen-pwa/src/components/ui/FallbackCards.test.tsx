import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { FallbackCards } from './FallbackCards.js'

describe('FallbackCards', () => {
  it('displays hotline number on Call card', () => {
    render(<FallbackCards hotlineNumber="(054) 721-1216" />)
    const callButton = screen.getByRole('button', { name: 'Call hotline' })
    expect(callButton).toHaveTextContent('(054) 721-1216')
  })

  it('displays hotline number on SMS card', () => {
    render(<FallbackCards hotlineNumber="(054) 721-1216" />)
    const buttons = screen.getAllByText('(054) 721-1216')
    expect(buttons).toHaveLength(2)
  })

  it('sets correct aria-label on SMS button', () => {
    render(<FallbackCards hotlineNumber="(054) 721-1216" />)
    expect(screen.getByRole('button', { name: 'Send SMS to (054) 721-1216' })).toBeInTheDocument()
  })

  it('sets correct aria-label on Call button', () => {
    render(<FallbackCards hotlineNumber="(054) 721-1216" />)
    expect(screen.getByRole('button', { name: 'Call hotline' })).toBeInTheDocument()
  })
})
