/**
 * ReportForm Component Tests
 *
 * Tests the 4-field disaster report submission form.
 * Location rendering is controlled via props (userLocation / gpsError)
 * rather than a live geolocation hook — this keeps tests deterministic.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ReportForm } from '../ReportForm'

describe('ReportForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders all 4 fields', () => {
    render(<ReportForm />)

    // Photo: hidden file input is associated via htmlFor; the label is present
    expect(screen.getByLabelText(/photo/i)).toBeInTheDocument()

    // Location: the section heading label (not a form control, so query by text)
    expect(screen.getByText(/^location$/i)).toBeInTheDocument()

    expect(screen.getByLabelText(/description/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/phone/i)).toBeInTheDocument()
  })

  it('shows photo capture area', () => {
    render(<ReportForm />)

    expect(screen.getByText(/take photo/i)).toBeInTheDocument()
  })

  it('shows GPS location when available', () => {
    render(
      <ReportForm
        userLocation={{ latitude: 14.1, longitude: 122.9 }}
      />
    )

    // Should display a resolved location string (barangay + municipality)
    const locationSection = screen.getByTestId('location-display')
    expect(locationSection).toBeInTheDocument()
    expect(locationSection.textContent).not.toBe('')
  })

  it('shows manual dropdowns when GPS denied', () => {
    render(<ReportForm gpsError="PERMISSION_DENIED" />)

    expect(screen.getByRole('combobox', { name: /municipality/i })).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: /barangay/i })).toBeInTheDocument()
  })

  it('validates phone number format', async () => {
    const user = userEvent.setup()
    render(<ReportForm />)

    const phoneInput = screen.getByLabelText(/phone/i)

    await user.type(phoneInput, '09123456789')
    await user.tab() // trigger blur validation

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument()
    })
  })

  it('submits form with valid data', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()

    render(
      <ReportForm
        userLocation={{ latitude: 14.1, longitude: 122.9 }}
        onSubmit={onSubmit}
      />
    )

    // Fill description
    const descriptionInput = screen.getByLabelText(/description/i)
    await user.type(descriptionInput, 'Flooding near the bridge')

    // Fill phone with valid PH format
    const phoneInput = screen.getByLabelText(/phone/i)
    await user.type(phoneInput, '+63 912 345 6789')

    // Submit
    const submitButton = screen.getByRole('button', { name: /submit report/i })
    await user.click(submitButton)

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledOnce()
    })

    const callArg = onSubmit.mock.calls[0][0]
    expect(callArg).toMatchObject({
      description: 'Flooding near the bridge',
      phone: '+63 912 345 6789',
    })
  })
})
