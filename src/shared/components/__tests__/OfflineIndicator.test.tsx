import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { OfflineIndicator } from '../OfflineIndicator'

describe('OfflineIndicator', () => {
  it('renders when offline', () => {
    render(<OfflineIndicator isOnline={false} />)
    expect(screen.getByText(/you're offline/i)).toBeInTheDocument()
  })

  it('does not render when online', () => {
    const { container } = render(<OfflineIndicator isOnline={true} />)
    expect(container.firstChild).toBeNull()
  })
})
