import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BeforeAfterGallery } from '../BeforeAfterGallery'

describe('BeforeAfterGallery', () => {
  const mockPhotos = {
    before: ['https://example.com/before1.jpg', 'https://example.com/before2.jpg'],
    after: ['https://example.com/after1.jpg'],
  }

  it('should display before and after sections', () => {
    render(<BeforeAfterGallery photos={mockPhotos} />)

    expect(screen.getByText(/before/i)).toBeInTheDocument()
    expect(screen.getByText(/after/i)).toBeInTheDocument()
  })

  it('should display all before photos', () => {
    render(<BeforeAfterGallery photos={mockPhotos} />)

    const beforeImages = screen.getAllByTestId(/before-photo-/)
    expect(beforeImages.length).toBe(2)
  })

  it('should display all after photos', () => {
    render(<BeforeAfterGallery photos={mockPhotos} />)

    const afterImages = screen.getAllByTestId(/after-photo-/)
    expect(afterImages.length).toBe(1)
  })

  it('should open fullscreen viewer when photo is clicked', async () => {
    const user = userEvent.setup()
    render(<BeforeAfterGallery photos={mockPhotos} />)

    await user.click(screen.getAllByTestId(/before-photo-/)[0])

    // Should show close button in fullscreen view
    expect(screen.getByRole('button', { name: /close/i })).toBeInTheDocument()
  })

  it('should render nothing when photos are empty', () => {
    render(<BeforeAfterGallery photos={{ before: [], after: [] }} />)

    expect(screen.queryByText(/before/i)).not.toBeInTheDocument()
  })
})