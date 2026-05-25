import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { verifyPasswordResetCode, confirmPasswordReset } from 'firebase/auth'
import { auth } from '../app/firebase'

export function ResetPasswordPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [verified, setVerified] = useState(false)
  const [success, setSuccess] = useState(false)
  const [email, setEmail] = useState('')

  const oobCode = searchParams.get('oobCode')

  useEffect(() => {
    if (!oobCode) {
      // Defer state update to avoid cascading render
      const id = requestAnimationFrame(() => {
        setError('Invalid or expired password reset link.')
        setLoading(false)
      })
      return () => {
        cancelAnimationFrame(id)
      }
    }

    let cancelled = false
    verifyPasswordResetCode(auth, oobCode)
      .then((emailAddress) => {
        if (cancelled) return
        setEmail(emailAddress)
        setVerified(true)
        setLoading(false)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'Invalid or expired reset link.')
        setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [oobCode])

  async function handleSubmit(e: { preventDefault: () => void }) {
    e.preventDefault()
    setError(null)

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    if (!oobCode) {
      setError('Invalid reset link.')
      return
    }

    setSubmitting(true)
    try {
      await confirmPasswordReset(auth, oobCode, newPassword)
      setSuccess(true)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to reset password.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[var(--color-surface)]">
        <div
          role="status"
          className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white"
        />
      </div>
    )
  }

  if (success) {
    return (
      <div className="flex h-screen items-center justify-center bg-[var(--color-surface)]">
        <div className="w-full max-w-sm rounded-lg border border-white/10 bg-[var(--color-surface-elevated)] p-8 text-center">
          <h1 className="text-xl font-semibold text-[var(--color-text-primary)]">Password Reset</h1>
          <p className="mt-4 text-sm text-[var(--color-text-secondary)]">
            Your password has been updated successfully.
          </p>
          <button
            type="button"
            onClick={() => {
              void navigate('/login')
            }}
            className="mt-6 w-full rounded-md bg-[var(--color-sienna)] py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
          >
            Sign In
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen items-center justify-center bg-[var(--color-surface)]">
      <div className="w-full max-w-sm rounded-lg border border-white/10 bg-[var(--color-surface-elevated)] p-8">
        <div className="mb-6 text-center">
          <h1 className="text-xl font-semibold text-[var(--color-text-primary)]">Reset Password</h1>
          {verified && <p className="mt-1 text-sm text-[var(--color-text-muted)]">{email}</p>}
        </div>

        {error && (
          <p role="alert" className="mb-4 text-sm text-[var(--color-danger)]">
            {error}
          </p>
        )}

        {verified && (
          <form
            onSubmit={(e) => {
              void handleSubmit(e)
            }}
          >
            <div className="space-y-4">
              <div>
                <label
                  htmlFor="new-password"
                  className="block text-xs font-medium uppercase tracking-wider text-[var(--color-text-muted)]"
                >
                  New Password
                </label>
                <input
                  id="new-password"
                  type="password"
                  className="mt-1 w-full rounded border border-white/10 bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none transition-colors focus:border-[var(--color-sienna)]"
                  value={newPassword}
                  onChange={(e) => {
                    setNewPassword(e.target.value)
                  }}
                  autoComplete="new-password"
                  required
                />
              </div>

              <div>
                <label
                  htmlFor="confirm-password"
                  className="block text-xs font-medium uppercase tracking-wider text-[var(--color-text-muted)]"
                >
                  Confirm Password
                </label>
                <input
                  id="confirm-password"
                  type="password"
                  className="mt-1 w-full rounded border border-white/10 bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none transition-colors focus:border-[var(--color-sienna)]"
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value)
                  }}
                  autoComplete="new-password"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-md bg-[var(--color-sienna)] py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {submitting ? 'Resetting…' : 'Reset Password'}
              </button>
            </div>
          </form>
        )}

        {!verified && !error && (
          <p className="text-center text-sm text-[var(--color-text-muted)]">
            Validating reset link…
          </p>
        )}
      </div>
    </div>
  )
}
