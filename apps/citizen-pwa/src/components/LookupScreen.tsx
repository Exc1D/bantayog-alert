import { useState } from 'react'
import { httpsCallable } from 'firebase/functions'
import { ArrowLeft } from 'lucide-react'
import {
  fns,
  hasFirebaseConfig,
  ensureSignedIn,
  FIREBASE_ENV_ERROR_MESSAGE,
} from '../services/firebase.js'

interface LookupResult {
  status: string
  lastStatusAt: number
  municipalityLabel: string
}

const FRIENDLY_ERROR = "We couldn't find that report. Check your codes and try again."

// Map server-side callable errors to friendly strings. Never surface raw error
// messages — they may leak internal state and confuse non-technical users.
function friendlyLookupError(err: unknown): string {
  if (!hasFirebaseConfig()) return FIREBASE_ENV_ERROR_MESSAGE
  const code = err && typeof err === 'object' && 'code' in err ? String(err.code) : ''
  // Treat permission-denied like not-found to avoid leaking existence.
  if (code === 'functions/not-found' || code === 'not-found') return FRIENDLY_ERROR
  if (code === 'functions/permission-denied' || code === 'permission-denied') return FRIENDLY_ERROR
  if (code === 'functions/unauthenticated' || code === 'unauthenticated') {
    return 'Please refresh and try again.'
  }
  if (code === 'functions/resource-exhausted' || code === 'resource-exhausted') {
    return 'Too many attempts. Please wait a minute and try again.'
  }
  return 'Something went wrong. Please try again or call the hotline.'
}

export function LookupScreen() {
  const [publicRef, setPublicRef] = useState('')
  const [secret, setSecret] = useState('')
  const [result, setResult] = useState<LookupResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.SyntheticEvent): Promise<void> {
    e.preventDefault()
    setError(null)
    setResult(null)
    const trimmedRef = publicRef.trim()
    const trimmedSecret = secret.trim()
    if (!trimmedRef || !trimmedSecret) {
      setError('Please enter both codes.')
      return
    }
    setLoading(true)
    try {
      if (!hasFirebaseConfig()) {
        throw new Error(FIREBASE_ENV_ERROR_MESSAGE)
      }
      await ensureSignedIn()
      const res = await httpsCallable(
        fns(),
        'requestLookup',
      )({
        publicRef: trimmedRef,
        secret: trimmedSecret,
      })
      setResult(res.data as LookupResult)
    } catch (e: unknown) {
      console.error('[LookupScreen] requestLookup failed:', e)
      setError(friendlyLookupError(e))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col min-h-[100dvh] bg-[#f0f4f4]">
      {/* Dark navy header */}
      <div className="flex items-center gap-3 px-4 pt-12 pb-6 bg-[#25292a] text-white">
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
        <h1 className="m-0 font-bold text-xl">Check Report Status</h1>
      </div>

      {/* Main content */}
      <div className="flex-1 px-4 pt-6">
        <h2 className="mb-1 text-xl font-extrabold text-[#001e40]">Track your report</h2>
        <p className="mb-1 text-[0.8125rem] text-[#52606d]">
          Enter your reference code and secret code to check your report status.
        </p>
        <p className="mb-6 text-[0.6875rem] text-[#7b8794] italic">
          Ilagay ang reference at secret code para macheck ang ulat.
        </p>

        <form
          onSubmit={(e) => {
            void handleSubmit(e)
          }}
        >
          <label className="block mb-4">
            <span className="block text-xs font-semibold uppercase tracking-wider mb-2 text-[#5e6667]">
              Reference Code
            </span>
            <input
              value={publicRef}
              onChange={(e) => {
                setPublicRef(e.target.value)
              }}
              required
              className="font-mono tracking-widest w-full h-12 rounded-xl px-4 text-base bg-white border border-[#d5dedd] outline-none focus:border-[#0f9488] motion-safe:transition-colors motion-safe:duration-200"
              placeholder="BA-2026-XXXXX"
            />
          </label>

          <label className="block mb-6">
            <span className="block text-xs font-semibold uppercase tracking-wider mb-2 text-[#5e6667]">
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
              className="font-mono tracking-widest w-full h-12 rounded-xl px-4 text-base bg-white border border-[#d5dedd] outline-none focus:border-[#0f9488] motion-safe:transition-colors motion-safe:duration-200"
              placeholder="Your secret code"
            />
          </label>

          <button
            type="submit"
            disabled={loading}
            className={`w-full h-14 rounded-xl text-white font-semibold text-base border-0 bg-gradient-to-br from-[#0f9488] to-[#0d7377] ${loading ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer'}`}
          >
            {loading ? 'Checking…' : 'Check Status'}
          </button>
        </form>

        {error && (
          <div role="alert" className="mt-4">
            <p className="text-[#b71c1c] text-sm font-semibold">{error}</p>
          </div>
        )}

        {result && (
          <div className="mt-4 mb-6 p-4 bg-white rounded-xl">
            <div className="flex justify-between mb-3">
              <span className="text-[0.8125rem] text-[#52606d]">Status</span>
              <span className="font-bold text-[#001e40]">{result.status}</span>
            </div>
            <div className="flex justify-between mb-3">
              <span className="text-[0.8125rem] text-[#52606d]">Municipality</span>
              <span className="font-semibold text-[#001e40]">{result.municipalityLabel}</span>
            </div>
            <div className="flex justify-between mb-3">
              <span className="text-[0.8125rem] text-[#52606d]">Last update</span>
              <span className="font-semibold text-[#001e40]">
                {new Date(result.lastStatusAt).toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[0.8125rem] text-[#52606d]">Verified by</span>
              <span className="font-semibold text-[#001e40]">
                {`${result.municipalityLabel} MDRRMO`}
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                setResult(null)
              }}
              className="mt-4 w-full h-10 rounded-xl bg-surface-100 text-surface-700 text-sm font-medium border-none cursor-pointer"
            >
              Check another report
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
