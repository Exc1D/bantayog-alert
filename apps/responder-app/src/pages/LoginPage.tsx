import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { auth } from '../app/firebase'
import { signInWithEmailAndPassword } from 'firebase/auth'

export function LoginPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleLogin(e: React.SubmitEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password)
      const tokenResult = await cred.user.getIdTokenResult()
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
    <main>
      <h1>Responder Login</h1>
      <form
        onSubmit={(e) => {
          void handleLogin(e)
        }}
      >
        <div>
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value)
            }}
            autoComplete="email"
            required
          />
        </div>
        <div>
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value)
            }}
            autoComplete="current-password"
            required
          />
        </div>
        {error && <p role="alert">{error}</p>}
        <button type="submit" disabled={loading}>
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </main>
  )
}
