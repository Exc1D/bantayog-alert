/**
 * SignUpFlow — Multi-step citizen registration wizard
 *
 * Steps:
 *  1. Name (required)
 *  2. Email (required, validated)
 *  3. Password (required, strength indicator)
 *  4. Phone (optional, PH mobile format)
 *  5. Municipality (required, for emergency response coordination)
 *  6. Privacy policy agreement (required checkbox)
 *  7. Review & Submit
 */

import { useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/shared/components/Button'
import { registerCitizen } from '@/domains/citizen/services/auth.service'
import { MUNICIPALITIES } from '@/shared/data/municipality'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SignUpFlowProps {
  onComplete: (userId: string) => void
  onCancel?: () => void
  initialPhone?: string
}

interface FormData {
  displayName: string
  email: string
  password: string
  phoneNumber: string
  municipality: string
  agreedToPrivacy: boolean
}

type Step = 1 | 2 | 3 | 4 | 5 | 6 | 7

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

const PH_MOBILE_REGEX = /^(\+?63|0)?[0-9]{10}$/

function validateName(name: string): string | null {
  if (!name.trim()) return 'Name is required'
  if (name.trim().length < 2) return 'Name must be at least 2 characters'
  return null
}

function validateEmail(email: string): string | null {
  if (!email.trim()) return 'Email is required'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Please enter a valid email address'
  return null
}

function validatePassword(password: string): string | null {
  if (!password) return 'Password is required'
  if (password.length < 8) return 'Password must be at least 8 characters'
  return null
}

function validatePhone(phone: string): string | null {
  if (!phone.trim()) return null // optional
  if (!PH_MOBILE_REGEX.test(phone.trim())) return 'Please enter a valid PH mobile number (e.g. 09171234567)'
  return null
}

function validateMunicipality(municipality: string): string | null {
  if (!municipality) return 'Municipality is required for emergency response coordination'
  return null
}

function validatePrivacy(agreed: boolean): string | null {
  if (!agreed) return 'You must agree to the Privacy Policy to create an account'
  return null
}

// ---------------------------------------------------------------------------
// Password strength
// ---------------------------------------------------------------------------

type Strength = 'empty' | 'weak' | 'fair' | 'strong'

function getPasswordStrength(password: string): Strength {
  if (!password) return 'empty'
  const hasLower = /[a-z]/.test(password)
  const hasUpper = /[A-Z]/.test(password)
  const hasDigit = /\d/.test(password)
  const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password)
  const variety = [hasLower, hasUpper, hasDigit, hasSpecial].filter(Boolean).length

  if (password.length < 8) return 'weak'
  if (variety <= 1) return 'weak'
  if (variety === 2 || variety === 3) return 'fair'
  return 'strong'
}

const strengthConfig = {
  weak: { label: 'Weak', color: 'text-red-500', barColor: 'bg-red-500' },
  fair: { label: 'Fair', color: 'text-yellow-600', barColor: 'bg-yellow-500' },
  strong: { label: 'Strong', color: 'text-green-600', barColor: 'bg-green-500' },
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SignUpFlow({ onComplete, onCancel, initialPhone }: SignUpFlowProps) {
  const [step, setStep] = useState<Step>(1)
  const [error, setError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [form, setForm] = useState<FormData>({
    displayName: '',
    email: '',
    password: '',
    phoneNumber: initialPhone || '',
    municipality: '',
    agreedToPrivacy: false,
  })

  const updateField = useCallback(<K extends keyof FormData>(key: K, value: FormData[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    setError(null)
    setSubmitError(null)
  }, [])

  const handleNext = useCallback(() => {
    setError(null)
    let err: string | null = null

    if (step === 1) err = validateName(form.displayName)
    if (step === 2) err = validateEmail(form.email)
    if (step === 3) err = validatePassword(form.password)
    if (step === 4) err = validatePhone(form.phoneNumber)
    if (step === 5) err = validateMunicipality(form.municipality)
    if (step === 6) err = validatePrivacy(form.agreedToPrivacy)

    if (err) { setError(err); return }
    setStep((s) => (s < 7 ? ((s + 1) as Step) : s))
  }, [step, form])

  const handleBack = useCallback(() => {
    setError(null)
    setStep((s) => (s > 1 ? ((s - 1) as Step) : s))
  }, [])

  const handleSubmit = useCallback(async () => {
    setSubmitError(null)
    setIsSubmitting(true)
    try {
      const result = await registerCitizen({
        email: form.email,
        password: form.password,
        displayName: form.displayName,
        phoneNumber: form.phoneNumber.trim() || undefined,
      })
      setIsSubmitting(false)
      onComplete(result.user.uid)
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Registration failed. Please try again.'
      setSubmitError(message)
      setIsSubmitting(false)
    }
  }, [form, onComplete])

  const strength = getPasswordStrength(form.password)
  const strengthInfo = strength !== 'empty' ? strengthConfig[strength] : null

  return (
    <div className="max-w-md mx-auto p-4 space-y-6" data-testid="signup-flow">
      {/* Progress indicator */}
      <div className="flex items-center gap-2" aria-label={`Step ${step} of 7`}>
        {([1, 2, 3, 4, 5, 6, 7] as Step[]).map((s) => (
          <div
            key={s}
            className={`h-1.5 flex-1 rounded-full transition-colors ${
              s <= step ? 'bg-primary-blue' : 'bg-gray-200'
            }`}
            aria-current={s === step ? 'step' : undefined}
          />
        ))}
      </div>

      {/* Step content */}
      <div className="min-h-[320px]">
        {step === 1 && (
          <section aria-label="Step 1">
            <h2 className="text-lg font-semibold mb-4">What is your name?</h2>
            <div className="space-y-4">
              <div>
                <label htmlFor="signup-name" className="block text-sm font-medium text-gray-700 mb-1">
                  Full Name <span className="text-red-500" aria-hidden="true">*</span>
                </label>
                <input
                  id="signup-name"
                  type="text"
                  autoComplete="name"
                  value={form.displayName}
                  onChange={(e) => updateField('displayName', e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleNext() }}
                  className="w-full min-h-[44px] px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-blue"
                  placeholder="Juan Dela Cruz"
                />
              </div>
            </div>
          </section>
        )}

        {step === 2 && (
          <section aria-label="Step 2">
            <h2 className="text-lg font-semibold mb-4">Your email address</h2>
            <div className="space-y-4">
              <div>
                <label htmlFor="signup-email" className="block text-sm font-medium text-gray-700 mb-1">
                  Email Address <span className="text-red-500" aria-hidden="true">*</span>
                </label>
                <input
                  id="signup-email"
                  type="email"
                  autoComplete="email"
                  value={form.email}
                  onChange={(e) => updateField('email', e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleNext() }}
                  className="w-full min-h-[44px] px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-blue"
                  placeholder="you@example.com"
                />
              </div>
            </div>
          </section>
        )}

        {step === 3 && (
          <section aria-label="Step 3">
            <h2 className="text-lg font-semibold mb-4">Create a password</h2>
            <div className="space-y-4">
              <div>
                <label htmlFor="signup-password" className="block text-sm font-medium text-gray-700 mb-1">
                  Password <span className="text-red-500" aria-hidden="true">*</span>
                </label>
                <input
                  id="signup-password"
                  type="password"
                  autoComplete="new-password"
                  value={form.password}
                  onChange={(e) => updateField('password', e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleNext() }}
                  className="w-full min-h-[44px] px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-blue"
                  placeholder="Min. 8 characters"
                />
              </div>

              {/* Strength indicator */}
              {strengthInfo && (
                <div data-testid="password-strength" className="space-y-1">
                  <div className="flex gap-1">
                    {(['weak', 'fair', 'strong'] as Strength[])
                      .filter((s) => s !== 'empty')
                      .map((s) => (
                        <div
                          key={s}
                          className={`h-1 flex-1 rounded-full ${
                            getPasswordStrength(form.password) === s
                              ? strengthConfig[s].barColor
                              : 'bg-gray-200'
                          }`}
                        />
                      ))}
                  </div>
                  <p className={`text-sm ${strengthInfo.color} font-medium`}>
                    {strengthInfo.label}
                  </p>
                </div>
              )}
            </div>
          </section>
        )}

        {step === 4 && (
          <section aria-label="Step 4">
            <h2 className="text-lg font-semibold mb-4">Your phone number (optional)</h2>
            <p className="text-sm text-gray-500 mb-4">
              Providing your phone number allows MDRRMO to contact you about your reports.
            </p>
            <div className="space-y-4">
              <div>
                <label htmlFor="signup-phone" className="block text-sm font-medium text-gray-700 mb-1">
                  Phone Number
                </label>
                <input
                  id="signup-phone"
                  type="tel"
                  autoComplete="tel"
                  value={form.phoneNumber}
                  onChange={(e) => updateField('phoneNumber', e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleNext() }}
                  className="w-full min-h-[44px] px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-blue"
                  placeholder="09171234567"
                />
              </div>
            </div>
          </section>
        )}

        {step === 5 && (
          <section aria-label="Step 5">
            <h2 className="text-lg font-semibold mb-4">Select your municipality</h2>
            <p className="text-sm text-gray-500 mb-4">
              This helps us coordinate emergency response in your area.
            </p>
            <div className="space-y-4">
              <div>
                <label htmlFor="signup-municipality" className="block text-sm font-medium text-gray-700 mb-1">
                  Municipality <span className="text-red-500" aria-hidden="true">*</span>
                </label>
                <select
                  id="signup-municipality"
                  value={form.municipality}
                  onChange={(e) => updateField('municipality', e.target.value)}
                  className="w-full min-h-[44px] px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-blue bg-white text-gray-900"
                  aria-label="Select Municipality"
                >
                  <option value="">-- Select Municipality --</option>
                  {MUNICIPALITIES.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
            </div>
          </section>
        )}

        {step === 6 && (
          <section aria-label="Step 6">
            <h2 className="text-lg font-semibold mb-4">Privacy Policy</h2>
            <div className="space-y-4">
              <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-700 max-h-40 overflow-y-auto">
                <p className="mb-2 font-medium">Bantayog Alert Privacy Policy</p>
                <p>
                  We collect your name, email, and optional phone number to coordinate
                  disaster response in Camarines Norte. Your data is used solely for
                  emergency management purposes and is protected under DPA compliance
                  guidelines. You have the right to access, correct, and delete your
                  personal data at any time.
                </p>
              </div>
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  id="signup-privacy"
                  type="checkbox"
                  checked={form.agreedToPrivacy}
                  onChange={(e) => updateField('agreedToPrivacy', e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-gray-300 text-primary-blue focus:ring-primary-blue"
                />
                <span className="text-sm text-gray-700">
                  I have read and agree to the{' '}
                  <Link
                    to="/privacy-policy"
                    className="text-primary-blue underline"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Privacy Policy
                  </Link>
                  . <span className="text-red-500" aria-hidden="true">*</span>
                </span>
              </label>
            </div>
          </section>
        )}

        {step === 7 && (
          <section aria-label="Step 7">
            <h2 className="text-lg font-semibold mb-4">Review your information</h2>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between border-b pb-2">
                <dt className="text-gray-500">Name</dt>
                <dd data-testid="review-display-name" className="font-medium">{form.displayName}</dd>
              </div>
              <div className="flex justify-between border-b pb-2">
                <dt className="text-gray-500">Email</dt>
                <dd data-testid="review-email" className="font-medium">{form.email}</dd>
              </div>
              {form.phoneNumber && (
                <div className="flex justify-between border-b pb-2">
                  <dt className="text-gray-500">Phone</dt>
                  <dd data-testid="review-phone" className="font-medium">{form.phoneNumber}</dd>
                </div>
              )}
              <div className="flex justify-between border-b pb-2">
                <dt className="text-gray-500">Municipality</dt>
                <dd data-testid="review-municipality" className="font-medium">{form.municipality}</dd>
              </div>
            </dl>
            {submitError && (
              <p role="alert" className="mt-4 text-red-600 text-sm">{submitError}</p>
            )}
          </section>
        )}

        {/* Error display */}
        {error && !submitError && (
          <p role="alert" className="text-red-600 text-sm mt-2">{error}</p>
        )}
      </div>

      {/* Navigation buttons */}
      <div className="flex gap-3">
        {onCancel && (
          <Button
            variant="secondary"
            onClick={onCancel}
            disabled={isSubmitting}
            aria-label="Cancel registration"
          >
            Cancel
          </Button>
        )}
        <div className="flex-1" />
        {step > 1 && step < 7 && (
          <Button variant="secondary" onClick={handleBack} disabled={isSubmitting}>
            Back
          </Button>
        )}
        {step < 7 ? (
          <Button onClick={handleNext} disabled={isSubmitting}>
            Next
          </Button>
        ) : (
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting}
            aria-label="Create account"
          >
            {isSubmitting ? 'Creating account...' : 'Create Account'}
          </Button>
        )}
      </div>
    </div>
  )
}
