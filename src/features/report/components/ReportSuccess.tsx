/**
 * ReportSuccess Component
 *
 * Displays a success confirmation screen after a user submits a report.
 * Shows the formatted Report ID, success message, share button,
 * create account button (for anonymous users), and navigation options.
 *
 * @example
 * ```tsx
 * function ReportFlow() {
 *   const [reportId, setReportId] = useState<string | null>(null);
 *
 *   if (reportId) {
 *     return (
 *       <ReportSuccess
 *         reportId={reportId}
 *         municipality="Daet"
 *         onCreateAccount={() => navigate('/signup')}
 *         onShare={() => shareReport(reportId)}
 *       />
 *     );
 *   }
 *
 *   return <ReportForm onSubmit={(data) => {
 *     const id = generateReportId(data);
 *     setReportId(id);
 *   }} />;
 * }
 * ```
 */

import { CheckCircle, Share2, UserPlus, Bell } from 'lucide-react'
import { Button } from '@/shared/components/Button'
import { useAuth } from '@/shared/hooks/useAuth'
import { usePushNotifications } from '@/features/alerts/hooks/usePushNotifications'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ReportSuccessProps {
  /** The generated report ID (e.g., "2024-DAET-0471") */
  reportId: string
  /** The municipality from the report location */
  municipality: string
  /** Whether the report was queued (offline) vs submitted immediately */
  isQueued?: boolean
  /** Whether this is the user's first report (to prompt for notifications) */
  isFirstReport?: boolean
  /** Callback when user clicks "Create account to track" */
  onCreateAccount?: () => void
  /** Callback when user clicks "Share this alert" */
  onShare?: () => void
  /** Callback when user clicks navigation back to feed/map */
  onNavigate?: () => void
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Formats the report ID for display with the # prefix.
 * @param reportId - The raw report ID string
 * @returns Formatted report ID (e.g., "#2024-DAET-0471")
 */
function formatReportId(reportId: string): string {
  return `#${reportId}`
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ReportSuccess({
  reportId,
  municipality,
  isQueued = false,
  isFirstReport = false,
  onCreateAccount,
  onShare,
  onNavigate,
}: ReportSuccessProps) {
  const { user } = useAuth()
  const isAnonymous = !user
  const { permission, requestPermission, isSupported } = usePushNotifications()

  const shouldPromptNotifications = isFirstReport && isSupported && permission !== 'granted'

  const handleShare = () => {
    onShare?.()
  }

  const handleCreateAccount = () => {
    onCreateAccount?.()
  }

  const handleNavigate = () => {
    onNavigate?.()
  }

  const handleEnableNotifications = async () => {
    await requestPermission()
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] px-4 py-8 text-center">
      {/* Success Icon */}
      <div className={`mb-6 ${isQueued ? 'text-orange-600' : 'text-green-600'}`} role="img" aria-label={isQueued ? 'Report queued' : 'Success checkmark'}>
        <CheckCircle size={80} strokeWidth={1.5} />
      </div>

      {/* Success Message */}
      <h1 className="text-2xl font-bold text-gray-900 mb-2">
        {isQueued ? 'Report queued for submission' : 'Report submitted successfully!'}
      </h1>

      {/* Report ID Display */}
      <div className="mb-8">
        <p className="text-sm text-gray-600 mb-1">Your Report ID</p>
        <p className="text-xl font-mono font-semibold text-gray-900" data-testid="report-id">
          {formatReportId(reportId)}
        </p>
      </div>

      {/* Action Buttons */}
      <div className="w-full max-w-sm space-y-3">
        {/* Share Button */}
        <Button
          variant="secondary"
          onClick={handleShare}
          className="w-full flex items-center justify-center gap-2"
        >
          <Share2 size={20} />
          Share this alert
        </Button>

        {/* Create Account Button - only for anonymous users */}
        {isAnonymous && (
          <Button
            variant="primary"
            onClick={handleCreateAccount}
            className="w-full flex items-center justify-center gap-2"
          >
            <UserPlus size={20} />
            Create account to track
          </Button>
        )}

        {/* Notification Prompt - only for first report when not already granted */}
        {shouldPromptNotifications && (
          <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg" data-testid="notification-prompt">
            <div className="flex items-start gap-3">
              <Bell className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm text-blue-900 font-medium mb-2">
                  Get notified when your report is verified?
                </p>
                <button
                  onClick={handleEnableNotifications}
                  className="w-full px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                  data-testid="enable-notifications-button"
                >
                  Enable Notifications
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Navigate Back Button */}
        {onNavigate && (
          <button
            onClick={handleNavigate}
            className="w-full text-sm text-gray-600 hover:text-gray-900 underline"
          >
            Return to feed/map
          </button>
        )}
      </div>

      {/* Additional Info */}
      <p className="mt-8 text-sm text-gray-500 max-w-md">
        {isQueued ? (
          <>
            Your report from {municipality} has been queued and will be submitted automatically
            when you're back online.
          </>
        ) : (
          <>
            Your report from {municipality} has been submitted and will be reviewed.
          </>
        )}
        {isAnonymous && <> Create an account to track updates on your report.</>}
      </p>
    </div>
  )
}
