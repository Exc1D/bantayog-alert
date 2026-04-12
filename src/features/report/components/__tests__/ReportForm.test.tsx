/**
 * ReportForm Component Tests
 *
 * Tests the simplified disaster report submission form.
 * Required fields: Photo, What's happening?, Location, Phone
 * Optional fields: Quick Questions, Anonymity checkbox
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

// Helper to create a mock File for photo upload tests
const createMockFile = () =>
  new File(['dummy'], 'test-photo.jpg', { type: 'image/jpeg' })

vi.mock('@/features/report/hooks/useReportQueue', () => ({
  useReportQueue: () => queueState,
}))

vi.mock('@/shared/hooks/useNetworkStatus', () => ({
  useNetworkStatus: () => networkState,
}))

// Mock useDuplicateCheck — return empty duplicates by default
const duplicateCheckState = vi.hoisted(() => ({
  duplicates: [] as Array<{ id: string; createdAt: Date; distanceKm: number; report: Record<string, unknown> }>,
  isChecking: false,
  checkForDuplicates: vi.fn(),
  clearDuplicates: vi.fn(),
}))

vi.mock('@/features/report/hooks/useDuplicateCheck', () => ({
  useDuplicateCheck: () => duplicateCheckState,
}))

// Mock firebase/firestore before any firebase-dependent imports
vi.mock('firebase/firestore', () => ({
  collection: vi.fn().mockReturnValue({}),
  query: vi.fn().mockReturnValue({}),
  where: vi.fn().mockReturnValue({}),
  orderBy: vi.fn().mockReturnValue({}),
  limit: vi.fn().mockReturnValue({}),
  getDocs: vi.fn().mockResolvedValue({ docs: [], forEach: () => {} }),
  Timestamp: { fromDate: vi.fn((date: Date) => ({ toDate: () => date })) },
}))

vi.mock('firebase/auth', () => ({
  onAuthStateChanged: vi.fn((auth, callback) => {
    callback(null)
    return vi.fn()
  }),
  signInWithEmailAndPassword: vi.fn(),
  signOut: vi.fn(),
}))

vi.mock('@/app/firebase/config', () => ({
  db: {},
  auth: {
    onAuthStateChanged: vi.fn((callback) => {
      callback(null)
      return vi.fn()
    }),
  },
}))

describe('ReportForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Restore default (online) state for each test
    networkState.isOnline = true
    queueState.enqueueReport.mockClear()
    queueState.isSyncing = false
    queueState.queueSize = 0
    // Reset duplicate check mock
    duplicateCheckState.duplicates = []
  })

  it('renders required fields', () => {
    render(<ReportForm />)

    // Photo: the label is present
    expect(screen.getByText(/^photo$/i)).toBeInTheDocument()

    // What's happening?: select dropdown
    expect(screen.getByLabelText(/what's happening/i)).toBeInTheDocument()

    // Location: section heading
    expect(screen.getByText(/^location$/i)).toBeInTheDocument()

    // Phone: form input
    expect(screen.getByLabelText(/phone/i)).toBeInTheDocument()
  })

  it('shows photo required error when submitting without photo', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()

    render(
      <ReportForm
        userLocation={{ latitude: 14.1, longitude: 122.9 }}
        onSubmit={onSubmit}
      />
    )

    // Fill required phone field but skip photo
    const phoneInput = screen.getByLabelText(/phone/i)
    await user.type(phoneInput, '+63 912 345 6789')

    // Submit
    await user.click(screen.getByRole('button', { name: /submit report/i }))

    // Should show photo required error
    await waitFor(() => {
      expect(screen.getByText(/photo is required/i)).toBeInTheDocument()
    })

    // onSubmit should NOT have been called
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('submits correct location data when using manual dropdowns', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()

    render(
      <ReportForm
        gpsError="PERMISSION_DENIED"
        onSubmit={onSubmit}
      />
    )

    // Upload photo
    const fileInput = screen.getByLabelText(/photo/i)
    await user.upload(fileInput, createMockFile())

    // Select municipality
    const municipalitySelect = screen.getByRole('combobox', { name: /municipality/i })
    await user.selectOptions(municipalitySelect, 'Daet')

    // Select barangay
    const barangaySelect = screen.getByRole('combobox', { name: /barangay/i })
    await user.selectOptions(barangaySelect, 'Bagasbas')

    // Fill phone
    const phoneInput = screen.getByLabelText(/phone/i)
    await user.type(phoneInput, '+63 912 345 6789')

    // Submit
    await user.click(screen.getByRole('button', { name: /submit report/i }))

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledOnce()
    })

    const callArg = onSubmit.mock.calls[0][0]
    expect(callArg.location).toMatchObject({
      type: 'manual',
      municipality: 'Daet',
      barangay: 'Bagasbas',
    })
  })

  it('submits form with all required fields and correct data shape', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()

    render(
      <ReportForm
        userLocation={{ latitude: 14.1, longitude: 122.9 }}
        onSubmit={onSubmit}
      />
    )

    // Upload photo
    const fileInput = screen.getByLabelText(/photo/i)
    await user.upload(fileInput, createMockFile())

    // Fill phone with valid PH format
    const phoneInput = screen.getByLabelText(/phone/i)
    await user.type(phoneInput, '+63 912 345 6789')

    // Submit
    await user.click(screen.getByRole('button', { name: /submit report/i }))

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledOnce()
    })

    // Verify complete data shape
    const callArg = onSubmit.mock.calls[0][0]
    expect(callArg).toMatchObject({
      incidentType: 'other',           // default
      photo: expect.any(File),
      location: {
        type: 'gps',
        latitude: 14.1,
        longitude: 122.9,
      },
      phone: '+63 912 345 6789',
      isAnonymous: false,              // default
      injuriesConfirmed: undefined,     // not answered
      situationWorsening: undefined,   // not answered
    })
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

  it('displays duplicate warning when duplicates exist', () => {
    // Override the duplicate check mock to return duplicates
    duplicateCheckState.duplicates = [
      {
        id: 'dup-1',
        createdAt: new Date(),
        distanceKm: 0.3,
        report: { incidentType: 'flood' },
      },
    ]

    render(
      <ReportForm
        userLocation={{ latitude: 14.1, longitude: 122.9 }}
      />
    )

    expect(screen.getByTestId('duplicate-warning')).toBeInTheDocument()
    expect(screen.getByText(/possible duplicate detected/i)).toBeInTheDocument()
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

  it('accepts valid PH phone format without error', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()

    render(
      <ReportForm
        userLocation={{ latitude: 14.1, longitude: 122.9 }}
        onSubmit={onSubmit}
      />
    )

    const phoneInput = screen.getByLabelText(/phone/i)
    await user.type(phoneInput, '+63 912 345 6789')
    await user.tab() // trigger blur validation

    // No error should appear for valid format
    await waitFor(() => {
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })

    // Should be able to submit
    const fileInput = screen.getByLabelText(/photo/i)
    await user.upload(fileInput, createMockFile())
    await user.click(screen.getByRole('button', { name: /submit report/i }))

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledOnce()
    })
  })

  it('includes incident type in submission data', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()

    render(
      <ReportForm
        userLocation={{ latitude: 14.1, longitude: 122.9 }}
        onSubmit={onSubmit}
      />
    )

    // Change incident type to flood
    const incidentSelect = screen.getByLabelText(/what's happening/i)
    await user.selectOptions(incidentSelect, 'flood')

    // Upload photo
    const fileInput = screen.getByLabelText(/photo/i)
    await user.upload(fileInput, createMockFile())

    // Fill phone
    const phoneInput = screen.getByLabelText(/phone/i)
    await user.type(phoneInput, '+63 912 345 6789')

    // Submit
    await user.click(screen.getByRole('button', { name: /submit report/i }))

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledOnce()
    })

    const callArg = onSubmit.mock.calls[0][0]
    expect(callArg.incidentType).toBe('flood')
  })

  describe('Quick Questions', () => {
    it('renders quick questions section', () => {
      render(<ReportForm />)

      expect(screen.getByText('Quick Questions (Optional)')).toBeInTheDocument()
      expect(screen.getByText(/anyone injured/i)).toBeInTheDocument()
      expect(screen.getByText(/is the situation getting worse/i)).toBeInTheDocument()
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

      // Upload a photo (required field)
      const fileInput = screen.getByLabelText(/photo/i)
      await user.upload(fileInput, createMockFile())

      // Fill phone with valid PH format
      const phoneInput = screen.getByLabelText(/phone/i)
      await user.type(phoneInput, '+63 912 345 6789')

      // Answer quick questions using specific radio indices
      const allRadios = screen.getAllByRole('radio')
      const injuriesYes = allRadios[0]
      const worseningYes = allRadios[3]

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

      // Upload a photo (required field)
      const fileInput = screen.getByLabelText(/photo/i)
      await user.upload(fileInput, createMockFile())

      // Fill required fields
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
        phone: '+63 912 345 6789',
        injuriesConfirmed: undefined,
        situationWorsening: undefined,
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

      // Upload a photo (required field)
      const fileInput = screen.getByLabelText(/photo/i)
      await user.upload(fileInput, createMockFile())

      // Fill required fields
      const phoneInput = screen.getByLabelText(/phone/i)
      await user.type(phoneInput, '+63 912 345 6789')

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

      // Upload a photo (required field)
      const fileInput = screen.getByLabelText(/photo/i)
      await user.upload(fileInput, createMockFile())

      // Fill required fields
      const phoneInput = screen.getByLabelText(/phone/i)
      await user.type(phoneInput, '+63 912 345 6789')

      // Submit
      await user.click(screen.getByRole('button', { name: /submit report/i }))

      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalledOnce()
      })

      const callArg = onSubmit.mock.calls[0][0]
      expect(callArg).toMatchObject({
        phone: '+63 912 345 6789',
        isAnonymous: false,
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

      // Upload a photo (required field)
      const fileInput = screen.getByLabelText(/photo/i)
      await user.upload(fileInput, createMockFile())

      // Fill required fields
      const phoneInput = screen.getByLabelText(/phone/i)
      await user.type(phoneInput, '+63 912 345 6789')

      // Submit
      await user.click(screen.getByRole('button', { name: /submit report/i }))

      // Should call enqueueReport
      await waitFor(() => {
        expect(queueState.enqueueReport).toHaveBeenCalledOnce()
      })

      // Verify the data shape passed to enqueueReport
      const [enqueuedData] = queueState.enqueueReport.mock.calls[0]
      expect(enqueuedData).toMatchObject({
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

      // Upload a photo (required field)
      const fileInput = screen.getByLabelText(/photo/i)
      await user.upload(fileInput, createMockFile())

      const phoneInput = screen.getByLabelText(/phone/i)
      await user.type(phoneInput, '+63 912 345 6789')

      await user.click(screen.getByRole('button', { name: /submit report/i }))

      await waitFor(() => {
        const reportIdElement = screen.getByTestId('report-id')
        expect(reportIdElement.textContent ?? '').toMatch(/queued$/)
      })
    })
  })
})
