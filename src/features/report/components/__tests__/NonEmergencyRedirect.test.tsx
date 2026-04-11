import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NonEmergencyRedirect } from '../NonEmergencyRedirect'

describe('NonEmergencyRedirect', () => {
  it('should display municipal contact information', () => {
    render(
      <NonEmergencyRedirect
        municipality="Daet"
        municipalHallPhone="+63 123 456 7890"
        mdrmoPhone="+63 123 456 7891"
        barangayCaptainPhone="+63 123 456 7892"
      />
    )

    // Use anchored regex to avoid /mdrmo/i matching "MD" in "Municipal Hall"
    expect(screen.getByText(/municipal hall/i)).toBeInTheDocument()
    expect(screen.getByText(/^MDRRMO Office$/i)).toBeInTheDocument()
  })

  it('should have clickable phone links', () => {
    render(
      <NonEmergencyRedirect
        municipality="Daet"
        municipalHallPhone="+63 123 456 7890"
        mdrmoPhone="+63 123 456 7891"
      />
    )

    const phoneLinks = screen.getAllByRole('link')
    expect(phoneLinks.length).toBeGreaterThan(0)
    phoneLinks.forEach(link => {
      expect(link.getAttribute('href')).toMatch(/^tel:/)
    })
  })

  it('should show cancel and go back buttons', () => {
    render(<NonEmergencyRedirect municipality="Daet" />)

    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /go back/i })).toBeInTheDocument()
  })

  it('should call onCancel when cancel is clicked', async () => {
    const user = userEvent.setup()
    const onCancel = vi.fn()

    render(<NonEmergencyRedirect municipality="Daet" onCancel={onCancel} />)

    await user.click(screen.getByRole('button', { name: /cancel/i }))
    expect(onCancel).toHaveBeenCalledOnce()
  })
})
