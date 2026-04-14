/**
 * AgeGate Component
 *
 * Displays an age verification screen for minors.
 * Required for COPPA compliance - users must be 13+ to use the app.
 *
 * @example
 * ```tsx
 * <AgeGate onVerified={() => setIsAgeVerified(true)} />
 * ```
 */

import { useState, useEffect } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Button } from './Button'

export interface AgeGateProps {
  onVerified: () => void
}

const STORAGE_KEY = 'age_verified'

// Safe localStorage access - guards against JSDOM/test environment issues
// TODO: Monitor for legitimate localStorage failures in production (quota exceeded, private browsing)
function safeGetStorageItem(key: string): string | null {
  try {
    return typeof window !== 'undefined' ? (window.localStorage?.getItem?.(key) ?? null) : null
  } catch {
    return null
  }
}

function safeSetStorageItem(key: string, value: string): void {
  try {
    window.localStorage?.setItem?.(key, value)
  } catch {
    // Non-fatal in tests/private browsing
  }
}

export function AgeGate({ onVerified }: AgeGateProps) {
  const [isChecked, setIsChecked] = useState(false)
  // Initialize directly from localStorage to prevent flicker on first render
  const [isAlreadyVerified] = useState(() => {
    return safeGetStorageItem(STORAGE_KEY) === 'true'
  })

  useEffect(() => {
    if (isAlreadyVerified) {
      onVerified()
    }
  }, [isAlreadyVerified, onVerified])

  const handleContinue = () => {
    if (!isChecked) return

    safeSetStorageItem(STORAGE_KEY, 'true')
    onVerified()
  }

  // Don't render if already verified
  if (isAlreadyVerified) {
    return null
  }

  return (
    <div className="fixed inset-0 bg-white z-50 flex items-center justify-center p-6">
      <div className="max-w-md text-center">
        <AlertTriangle className="w-16 h-16 text-primary-blue mx-auto mb-6" />

        <h1 className="text-2xl font-bold text-gray-900 mb-4">Age Verification Required</h1>

        <p className="text-gray-600 mb-6">
          You must be 13 years or older to use Bantayog Alert. This is required for legal compliance
          to protect children's privacy.
        </p>

        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={isChecked}
              onChange={(e) => setIsChecked(e.target.checked)}
              className="mt-1 w-5 h-5 rounded border-gray-300 text-primary-blue focus:ring-primary-blue"
            />
            <span className="text-left text-sm text-gray-700">
              I confirm that I am 13 years of age or older and agree to the{' '}
              <a href="/privacy-policy" className="text-primary-blue hover:underline">
                Privacy Policy
              </a>{' '}
              and{' '}
              <a href="/terms" className="text-primary-blue hover:underline">
                Terms of Service
              </a>
            </span>
          </label>
        </div>

        <Button onClick={handleContinue} disabled={!isChecked} className="w-full">
          Continue
        </Button>

        <p className="text-xs text-gray-500 mt-6">
          If you are under 13, please ask a parent or guardian to use this app on your behalf.
        </p>
      </div>
    </div>
  )
}
