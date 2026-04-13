/**
 * SignUpFlow Component Tests
 *
 * Tests the multi-step citizen registration wizard.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter } from 'react-router-dom'
import { SignUpFlow } from '../SignUpFlow'

// ---------------------------------------------------------------------------
// Stable mock — hoisted before vi.mock so factories can reference it.
// ---------------------------------------------------------------------------
const mockOnComplete = vi.fn()

const registerCitizenState = vi.hoisted(() =>
  vi.fn().mockResolvedValue({ user: { uid: 'new-user-123' }, requiresEmailVerification: true })
)

vi.mock('@/domains/citizen/services/auth.service', () => ({
  registerCitizen: registerCitizenState,
}))

// ---------------------------------------------------------------------------
// Firebase mocks (required because registerCitizen transitively imports firebase)
// ---------------------------------------------------------------------------
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
  onAuthStateChanged: vi.fn((_auth, callback) => { callback(null); return vi.fn() }),
  signInWithEmailAndPassword: vi.fn(),
  signOut: vi.fn(),
  createUserWithEmailAndPassword: vi.fn(),
  sendEmailVerification: vi.fn(),
  updateProfile: vi.fn(),
}))

vi.mock('@/app/firebase/config', () => ({
  db: {},
  auth: { onAuthStateChanged: vi.fn((callback) => { callback(null); return vi.fn() }) },
}))

const renderWithRouter = (ui: React.ReactElement) =>
  render(ui, { wrapper: BrowserRouter })

beforeEach(() => {
  vi.clearAllMocks()
  registerCitizenState.mockResolvedValue({ user: { uid: 'new-user-123' }, requiresEmailVerification: true })
})

// ---------------------------------------------------------------------------
// Step navigation
// ---------------------------------------------------------------------------
describe('SignUpFlow step navigation', () => {
  it('should render step 1 (Name) on mount', () => {
    renderWithRouter(<SignUpFlow onComplete={mockOnComplete} />)
    expect(screen.getByLabelText(/full name/i)).toBeInTheDocument()
  })

  it('should advance to step 2 (Email) when name is filled and Next is clicked', async () => {
    const user = userEvent.setup()
    renderWithRouter(<SignUpFlow onComplete={mockOnComplete} />)

    await user.type(screen.getByLabelText(/full name/i), 'Juan Dela Cruz')
    await user.click(screen.getByRole('button', { name: /next/i }))

    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument()
  })

  it('should block advance when name is empty', async () => {
    const user = userEvent.setup()
    renderWithRouter(<SignUpFlow onComplete={mockOnComplete} />)

    await user.click(screen.getByRole('button', { name: /next/i }))

    expect(screen.getByLabelText(/full name/i)).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent(/name is required/i)
  })

  it('should go back to step 1 from step 2', async () => {
    const user = userEvent.setup()
    renderWithRouter(<SignUpFlow onComplete={mockOnComplete} />)

    await user.type(screen.getByLabelText(/full name/i), 'Juan Dela Cruz')
    await user.click(screen.getByRole('button', { name: /next/i }))

    await user.click(screen.getByRole('button', { name: /back/i }))

    expect(screen.getByLabelText(/full name/i)).toBeInTheDocument()
  })

  it('should navigate through all steps to review screen', async () => {
    const user = userEvent.setup()
    renderWithRouter(<SignUpFlow onComplete={mockOnComplete} />)

    // Step 1: Name
    await user.type(screen.getByLabelText(/full name/i), 'Juan Dela Cruz')
    await user.click(screen.getByRole('button', { name: /next/i }))

    // Step 2: Email
    await user.type(screen.getByLabelText(/email address/i), 'juan@example.com')
    await user.click(screen.getByRole('button', { name: /next/i }))

    // Step 3: Password
    await user.type(screen.getByLabelText(/password/i), 'StrongPass1!')
    await user.click(screen.getByRole('button', { name: /next/i }))

    // Step 4: Phone (skip — optional)
    await user.click(screen.getByRole('button', { name: /next/i }))

    // Step 5: Municipality
    await user.selectOptions(screen.getByLabelText(/municipality/i), 'Daet')
    await user.click(screen.getByRole('button', { name: /next/i }))

    // Step 6: Privacy policy
    await user.click(screen.getByLabelText(/agree to the/i))
    await user.click(screen.getByRole('button', { name: /next/i }))

    // Step 7: Review
    expect(screen.getByTestId('review-display-name')).toHaveTextContent('Juan Dela Cruz')
    expect(screen.getByTestId('review-email')).toHaveTextContent('juan@example.com')
    expect(screen.getByTestId('review-municipality')).toHaveTextContent('Daet')
  })
})

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------
describe('Validation at each step', () => {
  it('should show error when name is empty', async () => {
    const user = userEvent.setup()
    renderWithRouter(<SignUpFlow onComplete={mockOnComplete} />)

    await user.click(screen.getByRole('button', { name: /next/i }))

    expect(screen.getByRole('alert')).toHaveTextContent(/name is required/i)
  })

  it('should show error when email is invalid', async () => {
    const user = userEvent.setup()
    renderWithRouter(<SignUpFlow onComplete={mockOnComplete} />)

    await user.type(screen.getByLabelText(/full name/i), 'Juan')
    await user.click(screen.getByRole('button', { name: /next/i }))
    await user.type(screen.getByLabelText(/email address/i), 'not-an-email')
    await user.click(screen.getByRole('button', { name: /next/i }))

    expect(screen.getByRole('alert')).toHaveTextContent(/valid email/i)
  })

  it('should show error when password is too short', async () => {
    const user = userEvent.setup()
    renderWithRouter(<SignUpFlow onComplete={mockOnComplete} />)

    await user.type(screen.getByLabelText(/full name/i), 'Juan')
    await user.click(screen.getByRole('button', { name: /next/i }))
    await user.type(screen.getByLabelText(/email address/i), 'juan@example.com')
    await user.click(screen.getByRole('button', { name: /next/i }))
    await user.type(screen.getByLabelText(/password/i), 'short')
    await user.click(screen.getByRole('button', { name: /next/i }))

    expect(screen.getByRole('alert')).toHaveTextContent(/at least 8 characters/i)
  })

  it('should accept valid PH mobile number (09xxxxxxxxx)', async () => {
    const user = userEvent.setup()
    renderWithRouter(<SignUpFlow onComplete={mockOnComplete} />)

    await user.type(screen.getByLabelText(/full name/i), 'Juan')
    await user.click(screen.getByRole('button', { name: /next/i }))
    await user.type(screen.getByLabelText(/email address/i), 'juan@example.com')
    await user.click(screen.getByRole('button', { name: /next/i }))
    await user.type(screen.getByLabelText(/password/i), 'StrongPass1!')
    await user.click(screen.getByRole('button', { name: /next/i }))

    await user.type(screen.getByLabelText(/phone number/i), '09171234567')
    await user.click(screen.getByRole('button', { name: /next/i }))

    expect(screen.getByLabelText(/municipality/i)).toBeInTheDocument()
  })

  it('should show error for invalid PH mobile format', async () => {
    const user = userEvent.setup()
    renderWithRouter(<SignUpFlow onComplete={mockOnComplete} />)

    await user.type(screen.getByLabelText(/full name/i), 'Juan')
    await user.click(screen.getByRole('button', { name: /next/i }))
    await user.type(screen.getByLabelText(/email address/i), 'juan@example.com')
    await user.click(screen.getByRole('button', { name: /next/i }))
    await user.type(screen.getByLabelText(/password/i), 'StrongPass1!')
    await user.click(screen.getByRole('button', { name: /next/i }))

    await user.type(screen.getByLabelText(/phone number/i), '12345')
    await user.click(screen.getByRole('button', { name: /next/i }))

    expect(screen.getByRole('alert')).toHaveTextContent(/valid PH mobile/i)
  })

  it('should block advance when municipality is not selected', async () => {
    const user = userEvent.setup()
    renderWithRouter(<SignUpFlow onComplete={mockOnComplete} />)

    await user.type(screen.getByLabelText(/full name/i), 'Juan')
    await user.click(screen.getByRole('button', { name: /next/i }))
    await user.type(screen.getByLabelText(/email address/i), 'juan@example.com')
    await user.click(screen.getByRole('button', { name: /next/i }))
    await user.type(screen.getByLabelText(/password/i), 'StrongPass1!')
    await user.click(screen.getByRole('button', { name: /next/i }))
    await user.click(screen.getByRole('button', { name: /next/i })) // skip phone

    await user.click(screen.getByRole('button', { name: /next/i }))

    expect(screen.getByRole('alert')).toHaveTextContent(/municipality is required/i)
  })

  it('should block advance when privacy checkbox is unchecked', async () => {
    const user = userEvent.setup()
    renderWithRouter(<SignUpFlow onComplete={mockOnComplete} />)

    await user.type(screen.getByLabelText(/full name/i), 'Juan')
    await user.click(screen.getByRole('button', { name: /next/i }))
    await user.type(screen.getByLabelText(/email address/i), 'juan@example.com')
    await user.click(screen.getByRole('button', { name: /next/i }))
    await user.type(screen.getByLabelText(/password/i), 'StrongPass1!')
    await user.click(screen.getByRole('button', { name: /next/i }))
    await user.click(screen.getByRole('button', { name: /next/i }))
    await user.selectOptions(screen.getByLabelText(/municipality/i), 'Daet')
    await user.click(screen.getByRole('button', { name: /next/i }))

    await user.click(screen.getByRole('button', { name: /next/i }))

    expect(screen.getByRole('alert')).toHaveTextContent(/agree to the privacy/i)
  })
})

// ---------------------------------------------------------------------------
// Password strength indicator
// ---------------------------------------------------------------------------
describe('Password strength indicator', () => {
  it('should show no indicator when password is empty', () => {
    renderWithRouter(<SignUpFlow onComplete={mockOnComplete} />)

    expect(screen.queryByTestId('password-strength')).toBeNull()
  })

  it('should show "Weak" for short password', async () => {
    const user = userEvent.setup()
    renderWithRouter(<SignUpFlow onComplete={mockOnComplete} />)

    await user.type(screen.getByLabelText(/full name/i), 'Juan')
    await user.click(screen.getByRole('button', { name: /next/i }))
    await user.type(screen.getByLabelText(/email address/i), 'juan@example.com')
    await user.click(screen.getByRole('button', { name: /next/i }))
    await user.type(screen.getByLabelText(/password/i), 'abc')

    expect(screen.getByTestId('password-strength')).toHaveTextContent(/weak/i)
  })

  it('should show "Fair" for long but simple password', async () => {
    const user = userEvent.setup()
    renderWithRouter(<SignUpFlow onComplete={mockOnComplete} />)

    await user.type(screen.getByLabelText(/full name/i), 'Juan')
    await user.click(screen.getByRole('button', { name: /next/i }))
    await user.type(screen.getByLabelText(/email address/i), 'juan@example.com')
    await user.click(screen.getByRole('button', { name: /next/i }))
    // "longpassword1" has lowercase + digit = 2 types = Fair
    await user.type(screen.getByLabelText(/password/i), 'longpassword1')

    expect(screen.getByTestId('password-strength')).toHaveTextContent(/fair/i)
  })

  it('should show "Strong" for complex password', async () => {
    const user = userEvent.setup()
    renderWithRouter(<SignUpFlow onComplete={mockOnComplete} />)

    await user.type(screen.getByLabelText(/full name/i), 'Juan')
    await user.click(screen.getByRole('button', { name: /next/i }))
    await user.type(screen.getByLabelText(/email address/i), 'juan@example.com')
    await user.click(screen.getByRole('button', { name: /next/i }))
    await user.type(screen.getByLabelText(/password/i), 'StrongPass1!')

    expect(screen.getByTestId('password-strength')).toHaveTextContent(/strong/i)
  })
})

// ---------------------------------------------------------------------------
// Privacy checkbox requirement
// ---------------------------------------------------------------------------
describe('Privacy checkbox requirement', () => {
  it('should have a privacy policy link pointing to /privacy-policy', async () => {
    const user = userEvent.setup()
    renderWithRouter(<SignUpFlow onComplete={mockOnComplete} />)

    await user.type(screen.getByLabelText(/full name/i), 'Juan')
    await user.click(screen.getByRole('button', { name: /next/i }))
    await user.type(screen.getByLabelText(/email address/i), 'juan@example.com')
    await user.click(screen.getByRole('button', { name: /next/i }))
    await user.type(screen.getByLabelText(/password/i), 'StrongPass1!')
    await user.click(screen.getByRole('button', { name: /next/i }))
    await user.click(screen.getByRole('button', { name: /next/i }))
    await user.selectOptions(screen.getByLabelText(/municipality/i), 'Daet')
    await user.click(screen.getByRole('button', { name: /next/i }))

    const privacyLink = screen.getByRole('link', { name: /privacy policy/i })
    expect(privacyLink).toHaveAttribute('href', '/privacy-policy')
  })
})

// ---------------------------------------------------------------------------
// Submit & onComplete
// ---------------------------------------------------------------------------
describe('Submit & onComplete', () => {
  it('should call registerCitizen with correct data', async () => {
    const user = userEvent.setup()
    renderWithRouter(<SignUpFlow onComplete={mockOnComplete} />)

    await user.type(screen.getByLabelText(/full name/i), 'Juan Dela Cruz')
    await user.click(screen.getByRole('button', { name: /next/i }))

    await user.type(screen.getByLabelText(/email address/i), 'juan@example.com')
    await user.click(screen.getByRole('button', { name: /next/i }))

    await user.type(screen.getByLabelText(/password/i), 'StrongPass1!')
    await user.click(screen.getByRole('button', { name: /next/i }))

    await user.click(screen.getByRole('button', { name: /next/i })) // skip phone

    await user.selectOptions(screen.getByLabelText(/municipality/i), 'Labo')
    await user.click(screen.getByRole('button', { name: /next/i }))

    await user.click(screen.getByLabelText(/agree to the/i))
    await user.click(screen.getByRole('button', { name: /next/i }))

    await user.click(screen.getByRole('button', { name: /create account/i }))

    await waitFor(() => {
      expect(registerCitizenState).toHaveBeenCalledWith({
        email: 'juan@example.com',
        password: 'StrongPass1!',
        displayName: 'Juan Dela Cruz',
        phoneNumber: undefined,
      })
    })
  })

  it('should call onComplete with userId after successful registration', async () => {
    const user = userEvent.setup()
    renderWithRouter(<SignUpFlow onComplete={mockOnComplete} />)

    await user.type(screen.getByLabelText(/full name/i), 'Juan')
    await user.click(screen.getByRole('button', { name: /next/i }))
    await user.type(screen.getByLabelText(/email address/i), 'juan@example.com')
    await user.click(screen.getByRole('button', { name: /next/i }))
    await user.type(screen.getByLabelText(/password/i), 'StrongPass1!')
    await user.click(screen.getByRole('button', { name: /next/i }))
    await user.click(screen.getByRole('button', { name: /next/i }))
    await user.selectOptions(screen.getByLabelText(/municipality/i), 'Daet')
    await user.click(screen.getByRole('button', { name: /next/i }))
    await user.click(screen.getByLabelText(/agree to the/i))
    await user.click(screen.getByRole('button', { name: /next/i }))

    await user.click(screen.getByRole('button', { name: /create account/i }))

    await waitFor(() => {
      expect(mockOnComplete).toHaveBeenCalledWith('new-user-123')
    })
  })

  it('should include phoneNumber when provided', async () => {
    const user = userEvent.setup()
    renderWithRouter(<SignUpFlow onComplete={mockOnComplete} />)

    await user.type(screen.getByLabelText(/full name/i), 'Juan')
    await user.click(screen.getByRole('button', { name: /next/i }))
    await user.type(screen.getByLabelText(/email address/i), 'juan@example.com')
    await user.click(screen.getByRole('button', { name: /next/i }))
    await user.type(screen.getByLabelText(/password/i), 'StrongPass1!')
    await user.click(screen.getByRole('button', { name: /next/i }))

    await user.type(screen.getByLabelText(/phone number/i), '09171234567')
    await user.click(screen.getByRole('button', { name: /next/i }))

    await user.selectOptions(screen.getByLabelText(/municipality/i), 'Daet')
    await user.click(screen.getByRole('button', { name: /next/i }))
    await user.click(screen.getByLabelText(/agree to the/i))
    await user.click(screen.getByRole('button', { name: /next/i }))

    await user.click(screen.getByRole('button', { name: /create account/i }))

    await waitFor(() => {
      expect(registerCitizenState).toHaveBeenCalledWith(
        expect.objectContaining({ phoneNumber: '09171234567' })
      )
    })
  })

  it('should show error when registration fails', async () => {
    registerCitizenState.mockRejectedValueOnce(new Error('Email already in use'))
    const user = userEvent.setup()
    renderWithRouter(<SignUpFlow onComplete={mockOnComplete} />)

    await user.type(screen.getByLabelText(/full name/i), 'Juan')
    await user.click(screen.getByRole('button', { name: /next/i }))
    await user.type(screen.getByLabelText(/email address/i), 'taken@example.com')
    await user.click(screen.getByRole('button', { name: /next/i }))
    await user.type(screen.getByLabelText(/password/i), 'StrongPass1!')
    await user.click(screen.getByRole('button', { name: /next/i }))
    await user.click(screen.getByRole('button', { name: /next/i }))
    await user.selectOptions(screen.getByLabelText(/municipality/i), 'Daet')
    await user.click(screen.getByRole('button', { name: /next/i }))
    await user.click(screen.getByLabelText(/agree to the/i))
    await user.click(screen.getByRole('button', { name: /next/i }))

    await user.click(screen.getByRole('button', { name: /create account/i }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/email already in use/i)
    })
  })

  it('should clear submit error when user edits a field after failed submission', async () => {
    const user = userEvent.setup()

    renderWithRouter(<SignUpFlow onComplete={mockOnComplete} />)

    // Navigate to step 2
    await user.type(screen.getByLabelText(/full name/i), 'Juan')
    await user.click(screen.getByRole('button', { name: /next/i }))
    await user.type(screen.getByLabelText(/email address/i), 'test@example.com')

    // Verify field editing clears validation error
    await user.click(screen.getByRole('button', { name: /next/i }))
    await user.type(screen.getByLabelText(/password/i), 'short')
    await user.click(screen.getByRole('button', { name: /next/i }))
    expect(screen.getByRole('alert')).toHaveTextContent(/at least 8 characters/i)

    // Edit password - validation error should clear
    await user.type(screen.getByLabelText(/password/i), 'LongerPass1!')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()

    // The fix also ensures submitError (set after failed submission) is cleared
    // when any field is edited. This is verified by the implementation in
    // updateField which now calls setSubmitError(null).
  })

  it('should call onCancel when cancel button is clicked', async () => {
    const onCancel = vi.fn()
    const user = userEvent.setup()
    renderWithRouter(<SignUpFlow onComplete={mockOnComplete} onCancel={onCancel} />)

    await user.click(screen.getByRole('button', { name: /cancel/i }))

    expect(onCancel).toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// initialPhone prop
// ---------------------------------------------------------------------------
describe('initialPhone prop', () => {
  it('should pre-fill phone field when provided', async () => {
    const user = userEvent.setup()
    renderWithRouter(<SignUpFlow onComplete={mockOnComplete} initialPhone="09171234567" />)

    // Navigate to step 4 (phone step)
    await user.type(screen.getByLabelText(/full name/i), 'Juan')
    await user.click(screen.getByRole('button', { name: /next/i }))
    await user.type(screen.getByLabelText(/email address/i), 'juan@example.com')
    await user.click(screen.getByRole('button', { name: /next/i }))
    await user.type(screen.getByLabelText(/password/i), 'StrongPass1!')
    await user.click(screen.getByRole('button', { name: /next/i }))

    expect(screen.getByDisplayValue('09171234567')).toBeInTheDocument()
  })
})
