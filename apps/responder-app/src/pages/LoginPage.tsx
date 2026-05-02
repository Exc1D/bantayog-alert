import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Shield, AlertTriangle } from 'lucide-react'
import { auth } from '../app/firebase'
import { signInWithEmailAndPassword } from 'firebase/auth'

export function LoginPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password)
      const tokenResult = await cred.user.getIdTokenResult(true)
      const role = (tokenResult.claims as Record<string, unknown> | undefined)?.role
      if (role !== 'responder') {
        const { signOut } = await import('firebase/auth')
        await signOut(auth)
        setError('This account is not registered as a responder.')
        setLoading(false)
        return
      }
      void navigate('/', { replace: true })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Login failed')
      setLoading(false)
    }
  }

  return (
    <main className="min-h-[100dvh] flex flex-col items-center justify-center px-app-lg bg-app-bg">
      <div className="w-full max-w-sm space-y-8">
        {/* Logo */}
        <div className="flex flex-col items-center">
          <div className="w-16 h-16 rounded-2xl bg-app-operational/20 flex items-center justify-center mb-4">
            <Shield size={32} className="text-app-operational" />
          </div>
          <h1 className="text-app-2xl font-bold text-app-text-primary">
            Bantayog Alert
          </h1>
          <p className="text-app-sm text-app-text-secondary mt-1">
            Responder App
          </p>
        </div>

        {/* Form */}
        <form onSubmit={(e) => void handleLogin(e)} className="space-y-4">
          <div className="space-y-2">
            <label
              htmlFor="email"
              className="block text-app-sm font-medium text-app-text-secondary"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
              className="w-full bg-app-surface border border-app-border rounded-lg px-app-md py-app-sm text-app-base text-app-text-primary placeholder:text-app-text-muted outline-none min-h-[44px] focus:border-app-operational transition-colors"
              placeholder="responder@example.com"
            />
          </div>

          <div className="space-y-2">
            <label
              htmlFor="password"
              className="block text-app-sm font-medium text-app-text-secondary"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
              className="w-full bg-app-surface border border-app-border rounded-lg px-app-md py-app-sm text-app-base text-app-text-primary placeholder:text-app-text-muted outline-none min-h-[44px] focus:border-app-operational transition-colors"
              placeholder="Enter your password"
            />
          </div>

          {error && (
            <div className="flex items-start gap-2 p-app-md rounded-lg bg-app-danger/20 border border-app-danger/30">
              <AlertTriangle size={16} className="text-app-danger shrink-0 mt-0.5" />
              <p className="text-app-sm text-app-danger">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="min-h-[44px] min-w-[44px] w-full px-app-lg py-app-md rounded-lg bg-app-operational text-white font-semibold text-app-base active:bg-app-operational/90 transition-colors disabled:opacity-50"
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        {/* Footer */}
        <p className="text-center text-app-xs text-app-text-muted">
          Managed staff accounts only. Contact your agency admin for access.
        </p>
      </div>
    </main>
  )
}
