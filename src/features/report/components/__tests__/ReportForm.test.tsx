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

// ---------------------------------------------------------------------------
// Stable mock objects — hoisted before vi.mock so factories can reference
// them. Tests modify .isOnline / .isSyncing / .queueSize directly.
// ---------------------------------------------------------------------------
const queueState = vi.hoisted(() => ({
  enqueueReport: vi.fn(),
  isSyncing: false,
  queueSize: 0,
}))

const networkState = vi.hoisted(() => ({
  isOnline: true,
}))

vi.mock('@/features/report/hooks/useReportQueue', () => ({
  useReportQueue: () => queueState,
}))

vi.mock('@/shared/hooks/useNetworkStatus', () => ({
  useNetworkStatus: () => networkState,
}))

describe('ReportForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Restore default (online) state for each test
    networkState.isOnline = true
    queueState.enqueueReport.mockClear()
    queueState.isSyncing = false
    queueState.queueSize = 0
  })

  it('renders all 4 fields', () => {
    render(<ReportForm />)

    // Photo: hidden file input is associated via htmlFor; the label is present
    expect(screen.getByLabelText(/photo/i)).toBeInTheDocument()

    // Location: the section heading label (not a form control, so query by text)
    expect(screen.getByText(/^location$/i)).toBeInTheDocument()

    expect(screen.getByLabelText(/description/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/phone/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
  })

  it('shows photo capture area', () => {
    render(<ReportForm />)

    expect(screen.getByText(/tap to take a photo/i)).toBeInTheDocument()
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

  describe('Quick Questions', () => {
    it('renders quick questions section', () => {
      render(<ReportForm />)

      expect(screen.getByText('Quick Questions (Optional)')).toBeInTheDocument()
      expect(screen.getByText('Anyone injured?')).toBeInTheDocument()
      expect(screen.getByText('Is the situation getting worse?')).toBeInTheDocument()
    })

    it('allows selecting injury status', async () => {
      const user = userEvent.setup()
      render(<ReportForm />)

      // Get all radio buttons - we have 2 groups (injuries and worsening)
      // First group: injuries (indices 0, 1, 2 = Yes, No, Skip)
      // Second group: worsening (indices 3, 4, 5 = Yes, No, Skip)
      const allRadios = screen.getAllByRole('radio')

      const injuriesYes = allRadios[0]
      const injuriesNo = allRadios[1]
      const injuriesSkip = allRadios[2]

      // Initially none selected
      expect(injuriesYes).not.toBeChecked()
      expect(injuriesNo).not.toBeChecked()

      // Click Yes
      await user.click(injuriesYes)
      expect(injuriesYes).toBeChecked()
      expect(injuriesNo).not.toBeChecked()

      // Click No
      await user.click(injuriesNo)
      expect(injuriesYes).not.toBeChecked()
      expect(injuriesNo).toBeChecked()

      // Click Skip
      await user.click(injuriesSkip)
      expect(injuriesYes).not.toBeChecked()
      expect(injuriesNo).not.toBeChecked()
      expect(injuriesSkip).toBeChecked()
    })

    it('allows selecting situation status', async () => {
      const user = userEvent.setup()
      render(<ReportForm />)

      // Get all radio buttons - second group is for worsening situation
      const allRadios = screen.getAllByRole('radio')
      const worseningYes = allRadios[3] // Fourth radio is "Yes" for worsening

      // Click Yes for worsening
      await user.click(worseningYes)
      expect(worseningYes).toBeChecked()
    })

    it('includes quick questions in submission', async () => {
      const user = userEvent.setup()
      const onSubmit = vi.fn()

      render(
        <ReportForm
          userLocation={{ latitude: 14.1, longitude: 122.9 }}
          onSubmit={onSubmit}
        />
      )

      // Fill required fields
      const descriptionInput = screen.getByLabelText(/description/i)
      await user.type(descriptionInput, 'Fire in building')

      const phoneInput = screen.getByLabelText(/phone/i)
      await user.type(phoneInput, '+63 912 345 6789')

      // Answer quick questions using specific radio indices
      const allRadios = screen.getAllByRole('radio')
      const injuriesYes = allRadios[0] // First "Yes" is for injuries
      const worseningYes = allRadios[3] // Fourth radio (first "Yes" of second group)

      await user.click(injuriesYes)
      await user.click(worseningYes)

      // Submit
      const submitButton = screen.getByRole('button', { name: /submit report/i })
      await user.click(submitButton)

      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalledOnce()
      })

      const callArg = onSubmit.mock.calls[0][0]
      expect(callArg).toMatchObject({
        description: 'Fire in building',
        phone: '+63 912 345 6789',
        injuriesConfirmed: true,
        situationWorsening: true,
      })
    })

    it('submits with undefined when quick questions skipped', async () => {
      const user = userEvent.setup()
      const onSubmit = vi.fn()

      render(
        <ReportForm
          userLocation={{ latitude: 14.1, longitude: 122.9 }}
          onSubmit={onSubmit}
        />
      )

      // Fill required fields
      const descriptionInput = screen.getByLabelText(/description/i)
      await user.type(descriptionInput, 'Minor flooding')

      const phoneInput = screen.getByLabelText(/phone/i)
      await user.type(phoneInput, '+63 912 345 6789')

      // Submit without answering quick questions (they're optional)
      const submitButton = screen.getByRole('button', { name: /submit report/i })
      await user.click(submitButton)

      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalledOnce()
      })

      const callArg = onSubmit.mock.calls[0][0]
      expect(callArg).toMatchObject({
        description: 'Minor flooding',
        phone: '+63 912 345 6789',
        injuriesConfirmed: undefined,
        situationWorsening: undefined,
      })
    })
  })

  describe('Email Field', () => {
    it('shows email field as optional', () => {
      render(<ReportForm />)

      expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
      // Verify "Optional" text appears somewhere on the form
      expect(screen.getAllByText(/Optional/i).length).toBeGreaterThan(0)
    })

    it('validates email format when provided', async () => {
      const user = userEvent.setup()
      render(<ReportForm />)

      const emailInput = screen.getByLabelText(/email/i)
      await user.type(emailInput, 'invalid-email')
      await user.tab() // trigger blur validation

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument()
        expect(screen.getByRole('alert')).toHaveTextContent(/valid email/i)
      })
    })

    it('accepts valid email format', async () => {
      const user = userEvent.setup()
      render(<ReportForm />)

      const emailInput = screen.getByLabelText(/email/i)
      await user.type(emailInput, 'test@example.com')
      await user.tab() // trigger blur validation

      // Should not show error
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })

    it('allows empty email (optional field)', async () => {
      const user = userEvent.setup()
      render(<ReportForm />)

      const emailInput = screen.getByLabelText(/email/i)
      await user.type(emailInput, '  ') // spaces only
      await user.tab() // trigger blur validation

      // Should not show error for empty optional field
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })

    it('includes email in submission when provided', async () => {
      const user = userEvent.setup()
      const onSubmit = vi.fn()

      render(
        <ReportForm
          userLocation={{ latitude: 14.1, longitude: 122.9 }}
          onSubmit={onSubmit}
        />
      )

      // Fill required fields
      await user.type(screen.getByLabelText(/description/i), 'Test incident')
      await user.type(screen.getByLabelText(/phone/i), '+63 912 345 6789')
      await user.type(screen.getByLabelText(/email/i), 'reporter@example.com')

      // Submit
      await user.click(screen.getByRole('button', { name: /submit report/i }))

      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalledOnce()
      })

      const callArg = onSubmit.mock.calls[0][0]
      expect(callArg).toMatchObject({
        description: 'Test incident',
        phone: '+63 912 345 6789',
        email: 'reporter@example.com',
      })
    })

    it('submits without email when not provided', async () => {
      const user = userEvent.setup()
      const onSubmit = vi.fn()

      render(
        <ReportForm
          userLocation={{ latitude: 14.1, longitude: 122.9 }}
          onSubmit={onSubmit}
        />
      )

      // Fill required fields only
      await user.type(screen.getByLabelText(/description/i), 'Test incident')
      await user.type(screen.getByLabelText(/phone/i), '+63 912 345 6789')

      // Submit without email
      await user.click(screen.getByRole('button', { name: /submit report/i }))

      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalledOnce()
      })

      const callArg = onSubmit.mock.calls[0][0]
      expect(callArg).toMatchObject({
        description: 'Test incident',
        phone: '+63 912 345 6789',
        email: undefined,
      })
    })
  })

  describe('Anonymity Checkbox', () => {
    it('renders anonymity checkbox', () => {
      render(<ReportForm />)

      expect(screen.getByRole('checkbox', { name: /submit this report anonymously/i })).toBeInTheDocument()
      expect(screen.getByText(/your identity will not be shared/i)).toBeInTheDocument()
    })

    it('defaults to not anonymous', () => {
      render(<ReportForm />)

      const checkbox = screen.getByRole('checkbox', { name: /submit this report anonymously/i })
      expect(checkbox).not.toBeChecked()
    })

    it('allows toggling anonymity', async () => {
      const user = userEvent.setup()
      render(<ReportForm />)

      const checkbox = screen.getByRole('checkbox', { name: /submit this report anonymously/i })

      // Initially unchecked
      expect(checkbox).not.toBeChecked()

      // Click to check
      await user.click(checkbox)
      expect(checkbox).toBeChecked()

      // Click to uncheck
      await user.click(checkbox)
      expect(checkbox).not.toBeChecked()
    })

    it('includes isAnonymous in submission when checked', async () => {
      const user = userEvent.setup()
      const onSubmit = vi.fn()

      render(
        <ReportForm
          userLocation={{ latitude: 14.1, longitude: 122.9 }}
          onSubmit={onSubmit}
        />
      )

      // Fill required fields
      await user.type(screen.getByLabelText(/description/i), 'Test incident')
      await user.type(screen.getByLabelText(/phone/i), '+63 912 345 6789')

      // Check anonymous checkbox
      const checkbox = screen.getByRole('checkbox', { name: /submit this report anonymously/i })
      await user.click(checkbox)

      // Submit
      await user.click(screen.getByRole('button', { name: /submit report/i }))

      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalledOnce()
      })

      const callArg = onSubmit.mock.calls[0][0]
      expect(callArg).toMatchObject({
        description: 'Test incident',
        phone: '+63 912 345 6789',
        isAnonymous: true,
      })
    })

    it('includes isAnonymous: false when unchecked', async () => {
      const user = userEvent.setup()
      const onSubmit = vi.fn()

      render(
        <ReportForm
          userLocation={{ latitude: 14.1, longitude: 122.9 }}
          onSubmit={onSubmit}
        />
      )

      // Fill required fields (don't check anonymous checkbox)
      await user.type(screen.getByLabelText(/description/i), 'Test incident')
      await user.type(screen.getByLabelText(/phone/i), '+63 912 345 6789')

      // Submit
      await user.click(screen.getByRole('button', { name: /submit report/i }))

      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalledOnce()
      })

      const callArg = onSubmit.mock.calls[0][0]
      expect(callArg).toMatchObject({
        description: 'Test incident',
        phone: '+63 912 345 6789',
        isAnonymous: false,
      })
    })
  })

  describe('Description Validation', () => {
    it('shows required indicator for description field', () => {
      render(<ReportForm />)

      const descLabel = screen.getByLabelText(/description/i)
      expect(descLabel).toBeInTheDocument()
      // Verify there's a required marker somewhere (the asterisk)
      expect(screen.getAllByText(/\*/i).length).toBeGreaterThan(0)
    })

    it('validates minimum length on blur', async () => {
      const user = userEvent.setup()
      render(<ReportForm />)

      const descInput = screen.getByLabelText(/description/i)
      await user.type(descInput, 'Short') // Only 5 characters
      await user.tab() // trigger blur

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument()
        expect(screen.getByRole('alert')).toHaveTextContent(/at least 10 characters/i)
      })
    })

    it('accepts descriptions with 10 or more characters', async () => {
      const user = userEvent.setup()
      render(<ReportForm />)

      const descInput = screen.getByLabelText(/description/i)
      await user.type(descInput, 'Valid description') // 17 characters
      await user.tab() // trigger blur

      // Should not show error
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })

    it('prevents submission with too short description', async () => {
      const user = userEvent.setup()
      const onSubmit = vi.fn()

      render(
        <ReportForm
          userLocation={{ latitude: 14.1, longitude: 122.9 }}
          onSubmit={onSubmit}
        />
      )

      // Fill with short description
      await user.type(screen.getByLabelText(/description/i), 'Brief')
      await user.type(screen.getByLabelText(/phone/i), '+63 912 345 6789')

      // Try to submit
      await user.click(screen.getByRole('button', { name: /submit report/i }))

      // Should not submit
      expect(onSubmit).not.toHaveBeenCalled()

      // Should show error
      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument()
        expect(screen.getByRole('alert')).toHaveTextContent(/at least 10 characters/i)
      })
    })

    it('clears error when description is fixed', async () => {
      const user = userEvent.setup()
      render(<ReportForm />)

      const descInput = screen.getByLabelText(/description/i)

      // Type short description
      await user.type(descInput, 'Hi')
      await user.tab()

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument()
      })

      // Fix by typing more
      await user.click(descInput)
      await user.type(descInput, ' there, this is a valid description')
      await user.tab()

      // Error should be cleared
      await waitFor(() => {
        expect(screen.queryByRole('alert')).not.toBeInTheDocument()
      })
    })
  })

  describe('Offline Queue Integration', () => {
    it('should show offline banner when network is unavailable', () => {
      networkState.isOnline = false

      render(<ReportForm />)

      expect(screen.getByTestId('offline-banner')).toBeInTheDocument()
      expect(screen.getByText(/you're offline/i)).toBeInTheDocument()
    })

    it('should queue report when submitted offline', async () => {
      const user = userEvent.setup()

      networkState.isOnline = false

      render(
        <ReportForm
          userLocation={{ latitude: 14.1, longitude: 122.9 }}
        />
      )

      // Fill required fields
      await user.type(screen.getByLabelText(/description/i), 'Flooding near the bridge')
      await user.type(screen.getByLabelText(/phone/i), '+63 912 345 6789')

      // Submit
      await user.click(screen.getByRole('button', { name: /submit report/i }))

      // Should call enqueueReport
      await waitFor(() => {
        expect(queueState.enqueueReport).toHaveBeenCalledOnce()
      })

      // Verify the data shape passed to enqueueReport
      const [enqueuedData] = queueState.enqueueReport.mock.calls[0]
      expect(enqueuedData).toMatchObject({
        description: 'Flooding near the bridge',
        phone: '+63 912 345 6789',
      })
      expect(enqueuedData.location).toMatchObject({
        type: 'gps',
        latitude: 14.1,
        longitude: 122.9,
      })

      // Should show queued success screen
      await waitFor(() => {
        expect(screen.getByText(/report queued/i)).toBeInTheDocument()
      })
    })

    it('should generate report ID with -queued suffix when offline', async () => {
      const user = userEvent.setup()

      networkState.isOnline = false

      render(
        <ReportForm
          userLocation={{ latitude: 14.1, longitude: 122.9 }}
        />
      )

      await user.type(screen.getByLabelText(/description/i), 'Test flooding')
      await user.type(screen.getByLabelText(/phone/i), '+63 912 345 6789')

      await user.click(screen.getByRole('button', { name: /submit report/i }))

      await waitFor(() => {
        const reportIdElement = screen.getByTestId('report-id')
        expect(reportIdElement.textContent ?? '').toMatch(/queued$/)
      })
    })
  })
})
