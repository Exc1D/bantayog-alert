import { useState } from 'react'
import type { SyntheticEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { signInWithEmailAndPassword } from 'firebase/auth'
import { auth } from '../app/firebase'
import styles from './LoginPage.module.css'

export function LoginPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleLogin(e: SyntheticEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password)
      if (import.meta.env.VITE_USE_EMULATOR !== 'true') {
        const tokenResult = await cred.user.getIdTokenResult(true)
        const role = (tokenResult.claims as Record<string, unknown> | undefined)?.role
        if (role !== 'responder') {
          const { signOut } = await import('firebase/auth')
          await signOut(auth)
          setError('This account is not registered as a responder.')
          return
        }
      }
      void navigate('/', { replace: true })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.brand}>
          <div className={styles.brandIcon} aria-hidden="true">
            🚨
          </div>
          <h1 className={styles.brandTitle}>BANTAYOG ALERT</h1>
          <p className={styles.brandSubtitle}>Responder Portal · Camarines Norte</p>
        </div>

        <form
          className={styles.form}
          onSubmit={(e) => {
            void handleLogin(e)
          }}
        >
          <div className={styles.field}>
            <label htmlFor="email" className={styles.label}>
              Email
            </label>
            <input
              id="email"
              type="email"
              className={styles.input}
              value={email}
              onChange={(e) => {
                setEmail(e.target.value)
              }}
              autoComplete="email"
              required
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="password" className={styles.label}>
              Password
            </label>
            <input
              id="password"
              type="password"
              className={styles.input}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value)
              }}
              autoComplete="current-password"
              required
            />
          </div>

          {error !== null && (
            <p role="alert" className={styles.error}>
              {error}
            </p>
          )}

          <button type="submit" className={styles.submitBtn} disabled={loading}>
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  )
}
