import { useEffect, useState, type SubmitEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { signInWithEmailAndPassword } from 'firebase/auth'
import { useAuth } from '@bantayog/shared-ui'
import { auth } from '../app/firebase'

export function LoginPage() {
  const navigate = useNavigate()
  const { user, loading: authLoading } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [verifyingRole, setVerifyingRole] = useState(false)

  useEffect(() => {
    if (user && !authLoading) {
      void navigate('/dashboard', { replace: true })
    }
  }, [user, authLoading, navigate])

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password)
      setVerifyingRole(true)
      const tokenResult = await cred.user.getIdTokenResult(true)
      const role = (tokenResult.claims as Record<string, unknown> | undefined)?.role
      const allowedRoles = ['provincial_superadmin', 'municipal_admin', 'agency_admin']
      if (!allowedRoles.includes(role as string)) {
        const { signOut } = await import('firebase/auth')
        await signOut(auth)
        setVerifyingRole(false)
        setError('This account does not have admin privileges.')
        return
      }
      // Navigation is handled by the useEffect that watches [user, authLoading]
      // Do NOT call navigate here — it fires before onAuthStateChanged updates
      // React state, causing AuthLayout to see user=null and redirect back.
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Sign in failed')
    } finally {
      setLoading(false)
      setVerifyingRole(false)
    }
  }

  return (
    <div className="flex h-screen items-center justify-center bg-[var(--color-surface)]">
      <div className="w-full max-w-sm rounded-lg border border-white/10 bg-[var(--color-surface-elevated)] p-8">
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
                Email
              </label>
              <input
                id="email"
                type="email"
                className="mt-1 w-full rounded border border-white/10 bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none transition-colors focus:border-[var(--color-sienna)]"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value)
                }}
                autoComplete="email"
                required
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-xs font-medium uppercase tracking-wider text-[var(--color-text-muted)]"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                className="mt-1 w-full rounded border border-white/10 bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none transition-colors focus:border-[var(--color-sienna)]"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value)
                }}
                autoComplete="current-password"
                required
              />
            </div>

            {error != null && (
              <p role="alert" className="text-sm text-[var(--color-danger)]">
                {error}
              </p>
            )}
            {verifyingRole && (
              <p className="text-sm text-[var(--color-text-muted)]">
                Verifying admin privileges…
              </p>
            )}

            <button
              type="submit"
              disabled={loading || verifyingRole}
              className="w-full rounded-md bg-[var(--color-sienna)] py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {loading ? 'Signing in…' : verifyingRole ? 'Verifying…' : 'Sign In'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
