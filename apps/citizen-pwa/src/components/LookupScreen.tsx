import { useState } from 'react'
import { httpsCallable } from 'firebase/functions'
import { ArrowLeft } from 'lucide-react'
import { fns, hasFirebaseConfig, FIREBASE_ENV_ERROR_MESSAGE } from '../services/firebase.js'
import { useReducedMotion } from '../hooks/useReducedMotion.js'

interface LookupResult {
  status: string
  lastStatusAt: number
  municipalityLabel: string
  verifiedBy?: string
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
    <div className="flex flex-col" style={{ minHeight: '100dvh', background: '#f0f4f4' }}>
      {/* Dark navy header */}
      <div
        className="flex items-center gap-3 px-4 pt-12 pb-6"
        style={{ background: '#25292a', color: '#fff' }}
      >
        <button
          type="button"
          onClick={() => {
            window.history.back()
          }}
          className="border-0 bg-transparent cursor-pointer p-0"
          aria-label="Go back"
        >
          <ArrowLeft size={20} color="#fff" />
        </button>
        <h1 className="m-0 font-bold" style={{ fontSize: 20 }}>
          Check Report Status
        </h1>
      </div>

      {/* Main content */}
      <div className="flex-1 px-4 pt-6">
        <h2 style={{ margin: '0 0 4px', fontSize: '1.25rem', fontWeight: 800, color: '#001e40' }}>
          Track your report
        </h2>
        <p style={{ margin: '0 0 4px', fontSize: '0.8125rem', color: '#52606d' }}>
          Enter your reference code and secret code to check your report status.
        </p>
        <p
          style={{
            margin: '0 0 24px',
            fontSize: '0.6875rem',
            color: '#7b8794',
            fontStyle: 'italic',
          }}
        >
          Ilagay ang reference at secret code para macheck ang ulat.
        </p>

        <form
          onSubmit={(e) => {
            void handleSubmit(e)
          }}
        >
          <label className="block mb-4">
            <span
              className="block text-xs font-semibold uppercase tracking-wider mb-2"
              style={{ color: '#5e6667' }}
            >
              Reference Code
            </span>
            <input
              value={publicRef}
              onChange={(e) => {
                setPublicRef(e.target.value)
              }}
              required
              className="font-mono tracking-widest w-full h-12 rounded-xl px-4 text-base bg-white"
              style={{
                border: '1px solid #d5dedd',
                outline: 'none',
                transition: reducedMotion ? 'none' : 'border-color 200ms',
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = '#0f9488'
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = '#d5dedd'
              }}
              placeholder="BA-2026-XXXXX"
            />
          </label>

          <label className="block mb-6">
            <span
              className="block text-xs font-semibold uppercase tracking-wider mb-2"
              style={{ color: '#5e6667' }}
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
              className="font-mono tracking-widest w-full h-12 rounded-xl px-4 text-base bg-white"
              style={{
                border: '1px solid #d5dedd',
                outline: 'none',
                transition: reducedMotion ? 'none' : 'border-color 200ms',
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = '#0f9488'
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = '#d5dedd'
              }}
              placeholder="Your secret code"
            />
          </label>

          <button
            type="submit"
            disabled={loading}
            className="w-full h-14 rounded-xl text-white font-semibold text-base border-0"
            style={{
              background: 'linear-gradient(135deg, #0f9488, #0d7377)',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? 'Checking…' : 'Check Status'}
          </button>
        </form>

        {error && (
          <div role="alert" className="mt-4">
            <p style={{ color: '#b71c1c', fontSize: '0.875rem', fontWeight: 600 }}>{error}</p>
          </div>
        )}

        {result && (
          <div className="mt-4 mb-6 p-4 bg-white rounded-xl">
            <div className="flex justify-between mb-3">
              <span style={{ fontSize: '0.8125rem', color: '#52606d' }}>Status</span>
              <span style={{ fontWeight: 700, color: '#001e40' }}>{result.status}</span>
            </div>
            <div className="flex justify-between mb-3">
              <span style={{ fontSize: '0.8125rem', color: '#52606d' }}>Municipality</span>
              <span style={{ fontWeight: 600, color: '#001e40' }}>{result.municipalityLabel}</span>
            </div>
            <div className="flex justify-between mb-3">
              <span style={{ fontSize: '0.8125rem', color: '#52606d' }}>Last update</span>
              <span style={{ fontWeight: 600, color: '#001e40' }}>
                {new Date(result.lastStatusAt).toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between">
              <span style={{ fontSize: '0.8125rem', color: '#52606d' }}>Verified by</span>
              <span style={{ fontWeight: 600, color: '#001e40' }}>
                {result.verifiedBy ?? 'Daet MDRRMO'}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
