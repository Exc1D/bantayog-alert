import { useState, useRef, useEffect } from 'react'
import { httpsCallable } from 'firebase/functions'
import { ArrowLeft, KeyRound } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useOnlineStatus } from '../hooks/useOnlineStatus.js'
import { loadReports } from '../services/localForageReports.js'
import {
  fns,
  hasFirebaseConfig,
  ensureSignedIn,
  FIREBASE_ENV_ERROR_MESSAGE,
} from '../services/firebase.js'

export const LOOKUP_SUCCESS_MESSAGE = 'Report found — tracking enabled'
const FRIENDLY_ERROR =
  "We couldn't find a report with that secret code. It may have expired (reports are tracked for 90 days)."
const OFFLINE_LOOKUP_ERROR = "You're offline — your code is saved, try again when connected."

const LOOKUP_ERROR_MAP: Record<string, string> = {
  'functions/not-found': FRIENDLY_ERROR,
  'not-found': FRIENDLY_ERROR,
  'functions/permission-denied': FRIENDLY_ERROR,
  'permission-denied': FRIENDLY_ERROR,
  'functions/unavailable': OFFLINE_LOOKUP_ERROR,
  unavailable: OFFLINE_LOOKUP_ERROR,
  offline: OFFLINE_LOOKUP_ERROR,
  'functions/unauthenticated': 'Please refresh and try again.',
  unauthenticated: 'Please refresh and try again.',
  'functions/resource-exhausted': 'Too many attempts. Please wait a minute and try again.',
  'resource-exhausted': 'Too many attempts. Please wait a minute and try again.',
}

class LookupError extends Error {
  readonly code: string
  constructor(message: string, code: string) {
    super(message)
    this.name = 'LookupError'
    this.code = code
  }
}

function isNetworkTypeError(err: unknown): boolean {
  return (
    err instanceof Error &&
    /\b(failed to fetch|failed to fetch resource|network error|network request failed)\b/i.test(
      err.message,
    )
  )
}

function normalizeSecretCode(secret: string): string {
  return secret.replace(/[^a-z0-9]/gi, '').toUpperCase()
}

function friendlyLookupError(err: unknown): string {
  if (!hasFirebaseConfig()) return FIREBASE_ENV_ERROR_MESSAGE
  if (isNetworkTypeError(err)) return OFFLINE_LOOKUP_ERROR
  const code = err && typeof err === 'object' && 'code' in err ? String(err.code) : ''
  const mapped = LOOKUP_ERROR_MAP[code]
  if (mapped !== undefined) return mapped
  return 'Something went wrong. Please try again or call the hotline.'
}

async function performLookup(
  trimmedSecret: string,
  isOnline: boolean,
  navigatorOnline: boolean,
): Promise<string> {
  const localReports = await loadReports()
  const localMatch = localReports.find((report) => report.secret === trimmedSecret)
  if (localMatch) {
    return localMatch.publicRef
  }
  if (!isOnline || !navigatorOnline) {
    throw new LookupError(OFFLINE_LOOKUP_ERROR, 'offline')
  }
  if (!hasFirebaseConfig()) {
    throw new Error(FIREBASE_ENV_ERROR_MESSAGE)
  }
  await ensureSignedIn()
  const res = await httpsCallable(fns(), 'requestLookup')({ secret: trimmedSecret })
  const data = res.data
  if (
    !data ||
    typeof data !== 'object' ||
    !('publicRef' in data) ||
    typeof data.publicRef !== 'string'
  ) {
    console.error('[LookupScreen] Invalid lookup response:', data)
    throw new Error('Invalid server response.')
  }
  return data.publicRef
}

function navigateToTrackedReport(
  navigate: ReturnType<typeof useNavigate>,
  publicRef: string,
): void {
  void navigate('/map', {
    state: {
      selectedReportPublicRef: publicRef,
      lookupSuccessMessage: LOOKUP_SUCCESS_MESSAGE,
    },
  })
}

export function LookupScreen() {
  const navigate = useNavigate()
  const { isOnline, navigatorOnline } = useOnlineStatus()
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
      const publicRef = await performLookup(trimmedSecret, isOnline, navigatorOnline)
      if (!isMountedRef.current) return
      navigateToTrackedReport(navigate, publicRef)
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
    <div className="flex flex-col min-h-[100dvh] bg-surface-100">
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
        <h2 className="mb-1 text-xl font-extrabold text-surface-900">Find your report</h2>
        <p className="mb-1 text-sm text-surface-600">
          Enter your secret code to check your report status.
        </p>
        <p className="mb-6 text-xs text-surface-600 italic">
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
              className="font-mono tracking-widest w-full h-12 rounded-xl px-4 text-base bg-white border border-surface-200 outline-none focus:border-brand-500 motion-safe:transition-colors motion-safe:duration-200"
              placeholder="Your secret code"
            />
          </label>

          <button
            type="submit"
            disabled={loading}
            className={`w-full h-14 rounded-xl text-white font-semibold text-base border-0 bg-brand-600 hover:bg-brand-700 transition-colors ${loading ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer'}`}
          >
            {loading ? 'Searching…' : 'Find My Report'}
          </button>
        </form>

        {error && (
          <div role="alert" className="mt-4">
            <p className="text-danger-700 text-sm font-semibold">{error}</p>
          </div>
        )}
      </div>
    </div>
  )
}
