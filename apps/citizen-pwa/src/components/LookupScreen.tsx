import { useState } from 'react'
import { httpsCallable } from 'firebase/functions'
import { ArrowLeft } from 'lucide-react'
import { fns, hasFirebaseConfig, FIREBASE_ENV_ERROR_MESSAGE } from '../services/firebase.js'
import { useReducedMotion } from '../hooks/useReducedMotion.js'

interface LookupResult {
  status: string
  lastStatusAt: number
  municipalityLabel: string
}

export function LookupScreen() {
  const [publicRef, setPublicRef] = useState('')
  const [secret, setSecret] = useState('')
  const [result, setResult] = useState<LookupResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const reducedMotion = useReducedMotion()

  async function handleSubmit(e: React.SyntheticEvent): Promise<void> {
    e.preventDefault()
    setError(null)
    setResult(null)
    setLoading(true)
    try {
      if (!hasFirebaseConfig()) {
        throw new Error(FIREBASE_ENV_ERROR_MESSAGE)
      }
      const res = await httpsCallable(fns(), 'requestLookup')({ publicRef, secret })
      setResult(res.data as LookupResult)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'lookup failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100dvh', background: '#f5f7fa' }}>
      <div
        style={{
          background: '#001e40',
          color: '#fff',
          padding: '16px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <button
          type="button"
          onClick={() => {
            window.history.back()
          }}
          style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 0 }}
          aria-label="Go back"
        >
          <ArrowLeft size={20} color="#fff" />
        </button>
        <h1 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 800 }}>Check Report Status</h1>
      </div>

      <form
        onSubmit={(e) => {
          void handleSubmit(e)
        }}
        style={{ padding: '24px 16px' }}
      >
        <label style={{ display: 'block', marginBottom: 16 }}>
          <span
            style={{
              display: 'block',
              fontSize: '0.8125rem',
              fontWeight: 600,
              color: '#001e40',
              marginBottom: 6,
            }}
          >
            Reference Code
          </span>
          <input
            value={publicRef}
            onChange={(e) => {
              setPublicRef(e.target.value)
            }}
            required
            style={{
              width: '100%',
              padding: '10px 0',
              border: 'none',
              borderBottom: '2px solid #001e40',
              fontSize: '1rem',
              background: 'transparent',
              outline: 'none',
              transition: reducedMotion ? 'none' : 'border-color 200ms',
            }}
            placeholder="BA-2026-XXXXX"
          />
        </label>

        <label style={{ display: 'block', marginBottom: 24 }}>
          <span
            style={{
              display: 'block',
              fontSize: '0.8125rem',
              fontWeight: 600,
              color: '#001e40',
              marginBottom: 6,
            }}
          >
            Secret Code
          </span>
          <input
            type="password"
            autoComplete="new-password"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            value={secret}
            onChange={(e) => {
              setSecret(e.target.value)
            }}
            required
            style={{
              width: '100%',
              padding: '10px 0',
              border: 'none',
              borderBottom: '2px solid #001e40',
              fontSize: '1rem',
              background: 'transparent',
              outline: 'none',
              transition: reducedMotion ? 'none' : 'border-color 200ms',
            }}
            placeholder="Your secret code"
          />
        </label>

        <button
          type="submit"
          disabled={loading}
          style={{
            width: '100%',
            padding: '14px',
            border: 'none',
            borderRadius: 999,
            background: '#f26522',
            color: '#fff',
            fontSize: '1rem',
            fontWeight: 700,
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? 'Looking up…' : 'Look Up'}
        </button>
      </form>

      {error && (
        <div role="alert" style={{ padding: '0 16px' }}>
          <p style={{ color: '#b71c1c', fontSize: '0.875rem', fontWeight: 600 }}>{error}</p>
        </div>
      )}

      {result && (
        <div style={{ padding: '16px', margin: '0 16px', background: '#fff', borderRadius: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ fontSize: '0.8125rem', color: '#52606d' }}>Status</span>
            <span style={{ fontWeight: 700, color: '#001e40' }}>{result.status}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ fontSize: '0.8125rem', color: '#52606d' }}>Municipality</span>
            <span style={{ fontWeight: 600, color: '#001e40' }}>{result.municipalityLabel}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.8125rem', color: '#52606d' }}>Last update</span>
            <span style={{ fontWeight: 600, color: '#001e40' }}>
              {new Date(result.lastStatusAt).toLocaleString()}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
