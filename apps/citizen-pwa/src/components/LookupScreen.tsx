import { useState, useRef, useEffect } from 'react'
import { httpsCallable } from 'firebase/functions'
import { ArrowLeft, KeyRound } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { loadReports } from '../services/localForageReports.js'
import {
  fns,
  hasFirebaseConfig,
  ensureSignedIn,
  FIREBASE_ENV_ERROR_MESSAGE,
} from '../services/firebase.js'

interface LookupResult {
  publicRef: string
  status: string
  lastStatusAt: number
  municipalityLabel: string
}

const FRIENDLY_ERROR =
  "We couldn't find a report with that secret code. It may have expired (reports are tracked for 90 days)."

function normalizeSecretCode(secret: string): string {
  return secret.replace(/[^a-z0-9]/gi, '').toUpperCase()
}

function friendlyLookupError(err: unknown): string {
  if (!hasFirebaseConfig()) return FIREBASE_ENV_ERROR_MESSAGE
  const code = err && typeof err === 'object' && 'code' in err ? String(err.code) : ''
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
  const navigate = useNavigate()
  const [secret, setSecret] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const isMountedRef = useRef(true)

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  async function handleSubmit(e: React.SyntheticEvent): Promise<void> {
    e.preventDefault()
    setError(null)
    const trimmedSecret = normalizeSecretCode(secret)
    if (!trimmedSecret) {
      setError('Please enter your secret code.')
      return
    }
    setLoading(true)
    try {
      const localReports = await loadReports()
      const localMatch = localReports.find((report) => report.secret === trimmedSecret)
      if (localMatch) {
        if (!isMountedRef.current) return
        void navigate(`/reports/${localMatch.publicRef}`)
        return
      }
      if (!hasFirebaseConfig()) {
        throw new Error(FIREBASE_ENV_ERROR_MESSAGE)
      }
      await ensureSignedIn()
      const res = await httpsCallable(fns(), 'requestLookup')({ secret: trimmedSecret })
      const result = res.data as LookupResult
      if (!result.publicRef || typeof result.publicRef !== 'string') {
        console.error('[LookupScreen] Invalid lookup response:', result)
        throw new Error('Invalid server response.')
      }
      if (!isMountedRef.current) return
      void navigate(`/reports/${result.publicRef}`)
    } catch (e: unknown) {
      console.error('[LookupScreen] requestLookup failed:', e)
      if (isMountedRef.current) {
        setError(friendlyLookupError(e))
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false)
      }
    }
  }

  return (
    <div className="flex flex-col min-h-[100dvh] bg-[#f0f4f4]">
      <div className="flex items-center gap-3 px-4 pt-12 pb-6 bg-brand-500 text-white">
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
        <h1 className="m-0 font-bold text-xl">Track your Report</h1>
      </div>

      <div className="flex-1 px-4 pt-6">
        <h2 className="mb-1 text-xl font-extrabold text-[#001e40]">Find your report</h2>
        <p className="mb-1 text-[0.8125rem] text-[#52606d]">
          Enter your secret code to check your report status.
        </p>
        <p className="mb-6 text-[0.6875rem] text-[#7b8794] italic">
          Ang iyong secret code ang susi sa iyong ulat.
        </p>

        <form
          onSubmit={(e) => {
            void handleSubmit(e)
          }}
        >
          <label className="block mb-6">
            <span className="flex items-center gap-1 text-xs font-semibold mb-2 text-brand-600">
              <KeyRound size={14} />
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
              maxLength={64}
              className="font-mono tracking-widest w-full h-12 rounded-xl px-4 text-base bg-white border border-[#d5dedd] outline-none focus:border-[#0f9488] motion-safe:transition-colors motion-safe:duration-200"
              placeholder="Your secret code"
            />
          </label>

          <button
            type="submit"
            disabled={loading}
            className={`w-full h-14 rounded-xl text-white font-semibold text-base border-0 bg-gradient-to-br from-[#0f9488] to-[#0d7377] ${loading ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer'}`}
          >
            {loading ? 'Searching…' : 'Find My Report'}
          </button>
        </form>

        {error && (
          <div role="alert" className="mt-4">
            <p className="text-[#b71c1c] text-sm font-semibold">{error}</p>
          </div>
        )}
      </div>
    </div>
  )
}
