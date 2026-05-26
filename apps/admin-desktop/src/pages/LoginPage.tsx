import { useEffect, useState, type SubmitEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth'
import { useAuth } from '@bantayog/shared-ui'
import { Eye, EyeOff } from 'lucide-react'
import { auth } from '../app/firebase'
import { announce } from '../components/LiveAnnouncer'

function friendlyAuthError(err: unknown): string {
  if (!(err instanceof Error)) return 'Something went wrong. Please try again.'
  const code = (err as unknown as Record<string, unknown>).code as string | undefined
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Invalid email or password. Please try again.'
    case 'auth/invalid-email':
      return 'Please enter a valid email address.'
    case 'auth/user-disabled':
      return 'This account has been disabled. Contact your administrator.'
    case 'auth/too-many-requests':
      return 'Too many failed attempts. Please try again later.'
    case 'auth/network-request-failed':
      return 'Network error. Please check your connection and try again.'
    default:
      return err.message
  }
}

function isNetworkError(err: unknown): boolean {
  const code = (err as Record<string, unknown>).code as string | undefined
  return (
    code === 'auth/network-request-failed' ||
    (err instanceof Error && /network|timeout|failed to fetch/i.test(err.message))
  )
}

export function LoginPage() {
  useEffect(() => {
    document.title = 'Sign In · Bantayog Alert'
  }, [])

  const navigate = useNavigate()
  const { user, loading: authLoading } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [emailError, setEmailError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [verifyingRole, setVerifyingRole] = useState(false)
  const [resetSent, setResetSent] = useState(false)
  const [resetSending, setResetSending] = useState(false)
  const [capsLockOn, setCapsLockOn] = useState(false)
  const [networkError, setNetworkError] = useState(false)

  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  const canSubmit = isEmailValid && password.length > 0 && !loading && !verifyingRole

  useEffect(() => {
    if (user && !authLoading) {
      void navigate('/dashboard', { replace: true })
    }
  }, [user, authLoading, navigate])

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault()
    setError(null)
    setNetworkError(false)
    setLoading(true)
    announce('Signing in, please wait.')
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password)
      setVerifyingRole(true)
      announce('Verifying admin privileges.')
      const tokenResult = await cred.user.getIdTokenResult(true)
      const role = (tokenResult.claims as Record<string, unknown> | undefined)?.role
      const allowedRoles = ['provincial_superadmin', 'municipal_admin', 'agency_admin']
      if (!allowedRoles.includes(role as string)) {
        const { signOut } = await import('firebase/auth')
        await signOut(auth)
        setVerifyingRole(false)
        const msg = 'This account does not have admin privileges.'
        setError(msg)
        announce(msg)
        return
      }
      // Navigation is handled by the useEffect that watches [user, authLoading]
    } catch (err: unknown) {
      setNetworkError(isNetworkError(err))
      const msg = friendlyAuthError(err)
      setError(msg)
      announce(`Error: ${msg}`)
    } finally {
      setLoading(false)
      setVerifyingRole(false)
    }
  }

  async function handleForgotPassword() {
    setError(null)
    setNetworkError(false)
    setEmailError(null)

    if (!email || !isEmailValid) {
      const msg = 'Please enter a valid email address to reset your password.'
      setEmailError(msg)
      announce(msg)
      return
    }

    setResetSending(true)
    announce('Sending password reset email.')
    try {
      await sendPasswordResetEmail(auth, email)
      const msg = 'Check your email for a password reset link.'
      setResetSent(true)
      announce(msg)
    } catch (err: unknown) {
      setNetworkError(isNetworkError(err))
      const msg = friendlyAuthError(err)
      setError(msg)
      announce(`Error: ${msg}`)
    } finally {
      setResetSending(false)
    }
  }

  return (
    <div className="flex h-screen items-center justify-center bg-[var(--color-surface)]">
      <div
        id="main-content"
        className="w-full max-w-sm rounded-lg border border-white/10 bg-[var(--color-surface-elevated)] p-8"
      >
        <div className="mb-6 text-center">
          <h1 className="text-xl font-semibold text-[var(--color-text-primary)]">Bantayog Alert</h1>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">
            Admin Console · Camarines Norte
          </p>
        </div>

        <form
          onSubmit={(e) => {
            void handleSubmit(e)
          }}
        >
          <div className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="block text-xs font-medium uppercase tracking-wider text-[var(--color-text-muted)]"
              >
                Email <span aria-hidden="true">*</span>
              </label>
              <input
                id="email"
                type="email"
                aria-invalid={emailError ? 'true' : 'false'}
                aria-describedby={emailError ? 'email-error' : undefined}
                className="mt-1 w-full rounded border border-white/10 bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none transition-colors focus:border-[var(--color-sienna)]"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value)
                  if (emailError) setEmailError(null)
                }}
                onBlur={() => {
                  if (email && !isEmailValid) {
                    const msg = 'Please enter a valid email address.'
                    setEmailError(msg)
                    announce(msg)
                  }
                }}
                autoComplete="email"
                required
              />
              {emailError && (
                <p
                  id="email-error"
                  role="alert"
                  className="mt-1 text-xs text-[var(--color-danger)]"
                >
                  {emailError}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-xs font-medium uppercase tracking-wider text-[var(--color-text-muted)]"
              >
                Password <span aria-hidden="true">*</span>
              </label>
              <div className="relative mt-1">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  aria-invalid={error && !emailError ? 'true' : 'false'}
                  aria-describedby={error && !emailError ? 'form-error' : undefined}
                  className="w-full rounded border border-white/10 bg-[var(--color-surface)] px-3 py-2 pr-10 text-sm text-[var(--color-text-primary)] outline-none transition-colors focus:border-[var(--color-sienna)]"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value)
                  }}
                  onKeyDown={(e) => {
                    setCapsLockOn(e.getModifierState('CapsLock'))
                  }}
                  onKeyUp={(e) => {
                    setCapsLockOn(e.getModifierState('CapsLock'))
                  }}
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => {
                    setShowPassword((prev) => !prev)
                  }}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] focus:text-[var(--color-text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-sienna)]"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {capsLockOn && (
                <p className="mt-1 text-xs text-[var(--color-warning)]">Caps Lock is on</p>
              )}
            </div>

            {error != null && (
              <div id="form-error" role="alert" className="space-y-1">
                <p className="text-sm text-[var(--color-danger)]">{error}</p>
                {networkError && (
                  <p className="text-xs text-[var(--color-text-muted)]">
                    Please check your connection and try again.
                  </p>
                )}
              </div>
            )}
            {verifyingRole && (
              <p className="text-sm text-[var(--color-text-muted)]">Verifying admin privileges…</p>
            )}

            <button
              type="submit"
              disabled={!canSubmit}
              className="w-full rounded-md bg-[var(--color-sienna)] py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {loading ? 'Signing in…' : verifyingRole ? 'Verifying…' : 'Sign In'}
            </button>

            {resetSent ? (
              <p className="text-center text-sm text-[var(--color-success)]">
                Check your email for a password reset link.
              </p>
            ) : (
              <div className="text-center">
                <button
                  type="button"
                  onClick={() => {
                    void handleForgotPassword()
                  }}
                  disabled={resetSending}
                  className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] hover:underline disabled:opacity-50"
                >
                  {resetSending ? 'Sending…' : 'Forgot password?'}
                </button>
              </div>
            )}

            {error === 'This account does not have admin privileges.' && (
              <p className="text-center text-xs text-[var(--color-text-muted)]">
                Need access? Contact your provincial superadmin.
              </p>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}
