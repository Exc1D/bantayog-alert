/**
 * ReportForm Privacy Consent Tests
 *
 * Tests DPA compliance: explicit consent required before submitting personal data.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, act, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ReportForm } from '../ReportForm'

// ---------------------------------------------------------------------------
// Stable mock objects — hoisted before vi.mock
// ---------------------------------------------------------------------------
const queueState = vi.hoisted(() => ({
  enqueueReport: vi.fn(),
  isSyncing: false,
  queueSize: 0,
}))

const networkState = vi.hoisted(() => ({
  isOnline: true,
}))

const geolocationState = vi.hoisted(() => ({
  coordinates: null as { latitude: number; longitude: number } | null,
  loading: false,
  error: null as string | null,
  manualLocation: null,
  setManualLocation: vi.fn(),
}))

const duplicateCheckState = vi.hoisted(() => ({
  duplicates: [] as Array<{
    id: string
    createdAt: Date
    distanceKm: number
    report: Record<string, unknown>
  }>,
  isChecking: false,
  checkForDuplicates: vi.fn(),
  clearDuplicates: vi.fn(),
}))

vi.mock('@/features/report/hooks/useReportQueue', () => ({
  useReportQueue: () => queueState,
}))

vi.mock('@/shared/hooks/useNetworkStatus', () => ({
  useNetworkStatus: () => networkState,
}))

vi.mock('@/shared/hooks/useGeolocation', () => ({
  useGeolocation: () => geolocationState,
}))

vi.mock('@/features/report/hooks/useDuplicateCheck', () => ({
  useDuplicateCheck: () => duplicateCheckState,
}))

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

// Helper to create a mock File for photo upload tests
const createMockFile = () => new File(['dummy'], 'test-photo.jpg', { type: 'image/jpeg' })

describe('ReportForm - Privacy Consent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    networkState.isOnline = true
    queueState.enqueueReport.mockClear()
    queueState.isSyncing = false
    queueState.queueSize = 0
    duplicateCheckState.duplicates = []
  })

  async function fillAllRequiredFields(
    screen: ReturnType<typeof screen>,
    user: ReturnType<typeof userEvent.setup>
  ) {
    // Upload photo
    const fileInput = screen.getByLabelText(/photo/i)
    await user.upload(fileInput, createMockFile())

    // Fill phone with valid PH format
    const phoneInput = screen.getByLabelText(/phone/i)
    await user.type(phoneInput, '+63 912 345 6789')
  }

  it('should render privacy consent checkbox', () => {
    render(<ReportForm />)

    const checkbox = screen.getByRole('checkbox', { name: /agree/i })
    expect(checkbox).toBeInTheDocument()
    expect(checkbox).not.toBeChecked()
  })

  it('should link to privacy policy', () => {
    render(<ReportForm />)

    const privacyLink = screen.getByRole('link', { name: /privacy policy/i })
    expect(privacyLink).toHaveAttribute('href', '/privacy-policy')
  })

  it('should require privacy policy agreement before submission', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(<ReportForm userLocation={{ latitude: 14.1, longitude: 122.9 }} onSubmit={onSubmit} />)

    await fillAllRequiredFields(screen, user)

    // Submit the form directly using fireEvent
    const form = document.querySelector('form') as HTMLFormElement
    await act(async () => {
      fireEvent.submit(form)
    })

    // onSubmit should NOT have been called because consent is required
    expect(onSubmit).not.toHaveBeenCalled()

    // Should have consent error
    const errorElement = await screen.findByText(/You must agree to the Privacy Policy/i)
    expect(errorElement).toBeInTheDocument()
  })

  it('should enable submission when consent is given', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()

    render(<ReportForm userLocation={{ latitude: 14.1, longitude: 122.9 }} onSubmit={onSubmit} />)

    await fillAllRequiredFields(screen, user)

    const consentCheckbox = screen.getByRole('checkbox', { name: /agree/i })
    await user.click(consentCheckbox)
    expect(consentCheckbox).toBeChecked()

    const submitButton = screen.getByRole('button', { name: /submit report/i })
    await user.click(submitButton)

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledOnce()
    })
  })

  it('should clear consent error when checkbox is checked', async () => {
    const user = userEvent.setup()

    render(<ReportForm userLocation={{ latitude: 14.1, longitude: 122.9 }} />)

    await fillAllRequiredFields(screen, user)

    // Submit the form directly using fireEvent
    const form = document.querySelector('form') as HTMLFormElement
    await act(async () => {
      fireEvent.submit(form)
    })

    // Should show error
    const errorElement = await screen.findByText(/You must agree to the Privacy Policy/i)
    expect(errorElement).toBeInTheDocument()

    // Check the consent checkbox
    const consentCheckbox = screen.getByRole('checkbox', { name: /agree/i })
    await user.click(consentCheckbox)

    // Error should be cleared
    expect(screen.queryByText(/You must agree to the Privacy Policy/i)).not.toBeInTheDocument()
  })

  it('should submit queued report when consent given and offline', async () => {
    const user = userEvent.setup()
    networkState.isOnline = false

    render(<ReportForm userLocation={{ latitude: 14.1, longitude: 122.9 }} />)

    await fillAllRequiredFields(screen, user)

    const consentCheckbox = screen.getByRole('checkbox', { name: /agree/i })
    await user.click(consentCheckbox)

    const submitButton = screen.getByRole('button', { name: /submit report/i })
    await user.click(submitButton)

    await waitFor(() => {
      expect(queueState.enqueueReport).toHaveBeenCalledOnce()
    })
  })
})
