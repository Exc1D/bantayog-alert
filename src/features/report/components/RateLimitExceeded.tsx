/**
 * RateLimitExceeded Component
 *
 * Displayed when user has exceeded the report submission rate limit.
 * Provides alternative contact methods for urgent reports.
 *
 * @example
 * ```tsx
 * <RateLimitExceeded
 *   mdrmoHotline="+63 123 456 7890"
 *   retryAfterMinutes={30}
 *   onOk={() => setShowForm(false)}
 * />
 * ```
 */

import { Clock, Phone, AlertTriangle } from 'lucide-react'
import { Button } from '@/shared/components/Button'

export interface RateLimitExceededProps {
  /** MDRRMO hotline for urgent reports */
  mdrmoHotline?: string
  /** Minutes until user can submit again */
  retryAfterMinutes?: number
  /** Callback when user acknowledges */
  onOk?: () => void
}

export function RateLimitExceeded({
  mdrmoHotline,
  retryAfterMinutes,
  onOk,
}: RateLimitExceededProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 py-8 text-center">
      <div className="mb-6">
        <AlertTriangle className="w-16 h-16 text-orange-500 mx-auto mb-4" aria-hidden="true" />
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          You've reached the reporting limit
        </h1>
        <p className="text-gray-600 max-w-md mx-auto">
          To prevent spam and abuse, we limit the number of reports you can submit.
          {retryAfterMinutes && (
            <> Please try again in {retryAfterMinutes} minutes.</>
          )}
        </p>
      </div>

      {/* Urgent reports info */}
      <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-6 max-w-md w-full">
        <p className="font-medium text-orange-800 mb-3">
          For urgent emergency reports:
        </p>

        {mdrmoHotline ? (
          <a
            href={`tel:${mdrmoHotline.replace(/\s/g, '')}`}
            className="flex items-center justify-center gap-2 p-3 bg-white rounded-lg hover:bg-orange-100 transition-colors"
          >
            <Phone className="w-5 h-5 text-orange-600" />
            <span className="font-medium text-orange-700">
              Call MDRRMO Hotline: {mdrmoHotline}
            </span>
          </a>
        ) : (
          <p className="text-sm text-orange-700">
            Please call your local MDRRMO office directly for urgent reports.
          </p>
        )}
      </div>

      {/* Retry countdown */}
      {retryAfterMinutes && (
        <div className="flex items-center gap-2 text-gray-500 mb-6">
          <Clock className="w-5 h-5" aria-hidden="true" />
          <span>You can submit another report in {retryAfterMinutes} minutes</span>
        </div>
      )}

      {/* Dismiss button */}
      {onOk && (
        <Button onClick={onOk}>
          OK
        </Button>
      )}
    </div>
  )
}
