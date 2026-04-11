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

import { CheckCircle, Share2, UserPlus } from 'lucide-react'
import { Button } from '@/shared/components/Button'
import { useAuth } from '@/shared/hooks/useAuth'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ReportSuccessProps {
  /** The generated report ID (e.g., "2024-DAET-0471") */
  reportId: string
  /** The municipality from the report location */
  municipality: string
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
  onCreateAccount,
  onShare,
  onNavigate,
}: ReportSuccessProps) {
  const { user } = useAuth()
  const isAnonymous = !user

  const handleShare = () => {
    onShare?.()
  }

  const handleCreateAccount = () => {
    onCreateAccount?.()
  }

  const handleNavigate = () => {
    onNavigate?.()
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] px-4 py-8 text-center">
      {/* Success Icon */}
      <div className="mb-6 text-green-600" role="img" aria-label="Success checkmark">
        <CheckCircle size={80} strokeWidth={1.5} />
      </div>

      {/* Success Message */}
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Report submitted successfully!</h1>

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
        Your report from {municipality} has been submitted and will be reviewed.
        {isAnonymous && <> Create an account to track updates on your report.</>}
      </p>
    </div>
  )
}
