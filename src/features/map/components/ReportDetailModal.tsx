import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ExternalLink } from 'lucide-react'
import { Modal } from '@/shared/components/Modal'
import { Button } from '@/shared/components/Button'
import { getDocument } from '@/shared/services/firestore.service'
import type { Report } from '@/shared/types/firestore.types'

interface ReportDetailModalProps {
  reportId: string | null
  onClose: () => void
}

/**
 * Modal that displays full details of a disaster report.
 * Shows comprehensive report information with a loading state.
 *
 * @param reportId - ID of the report to display (null = no modal)
 * @param onClose - Callback when modal should close
 */
export function ReportDetailModal({ reportId, onClose }: ReportDetailModalProps) {
  const navigate = useNavigate()
  const [report, setReport] = useState<Report | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fetch report data when reportId changes
  useEffect(() => {
    if (!reportId) {
      setReport(null)
      setError(null)
      return
    }

    async function fetchReport() {
      setIsLoading(true)
      setError(null)

      try {
        const data = await getDocument<Report>('reports', reportId)
        if (data) {
          setReport(data)
        } else {
          setError('Report not found')
        }
      } catch (err) {
        console.error('Failed to fetch report:', err)
        setError('Failed to load report details')
      } finally {
        setIsLoading(false)
      }
    }

    fetchReport()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportId])

  // Don't render if no reportId
  if (!reportId) {
    return null
  }

  const handleViewInFeed = () => {
    navigate(`/feed/${reportId}`)
    onClose()
  }

  const formatRelativeTime = (timestamp: number): string => {
    const now = Date.now()
    const diff = now - timestamp

    const seconds = Math.floor(diff / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)
    const days = Math.floor(hours / 24)

    if (seconds < 60) return 'just now'
    if (minutes < 60) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`
    if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`
    return `${days} day${days > 1 ? 's' : ''} ago`
  }

  const formatIncidentType = (type: string): string => {
    return type
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  }

  const getSeverityColor = (severity: string): string => {
    const colors = {
      low: 'bg-yellow-100 text-yellow-800',
      medium: 'bg-orange-100 text-orange-800',
      high: 'bg-red-100 text-red-800',
      critical: 'bg-red-200 text-red-900',
    }
    return colors[severity as keyof typeof colors] || 'bg-gray-100 text-gray-800'
  }

  const getStatusColor = (status: string): string => {
    const colors = {
      pending: 'bg-gray-100 text-gray-800',
      verified: 'bg-blue-100 text-blue-800',
      assigned: 'bg-purple-100 text-purple-800',
      responding: 'bg-indigo-100 text-indigo-800',
      resolved: 'bg-green-100 text-green-800',
      false_alarm: 'bg-gray-200 text-gray-600',
    }
    return colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-800'
  }

  return (
    <Modal isOpen={!!reportId} onClose={onClose} title="Report Details">
      <div className="space-y-4" data-testid="report-detail-modal">
        {/* Loading state */}
        {isLoading && (
          <div className="space-y-4" data-testid="report-loading">
            <div className="animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
              <div className="h-4 bg-gray-200 rounded w-1/2 mb-2" />
              <div className="h-4 bg-gray-200 rounded w-5/6" />
            </div>
            <div className="animate-pulse">
              <div className="h-32 bg-gray-200 rounded" />
            </div>
          </div>
        )}

        {/* Error state */}
        {error && (
          <div
            className="bg-red-50 border border-red-200 rounded-lg p-4"
            data-testid="report-error"
          >
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {/* Report content */}
        {report && !isLoading && (
          <div className="space-y-4" data-testid="report-content">
            {/* Type, Severity, and Status badges */}
            <div className="flex flex-wrap gap-2">
              <span className="px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-800">
                {formatIncidentType(report.incidentType)}
              </span>
              <span
                className={`px-3 py-1 rounded-full text-sm font-medium ${getSeverityColor(
                  report.severity
                )}`}
              >
                {report.severity.toUpperCase()}
              </span>
              <span
                className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(
                  report.status
                )}`}
              >
                {report.status.replace('_', ' ').toUpperCase()}
              </span>
            </div>

            {/* Description */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-1">Description</h3>
              <p className="text-gray-900">{report.description}</p>
            </div>

            {/* Location */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-1">Location</h3>
              <p className="text-gray-900">
                {report.approximateLocation.barangay},{' '}
                {report.approximateLocation.municipality}
              </p>
            </div>

            {/* Timestamp */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-1">Reported</h3>
              <p className="text-gray-600 text-sm">
                {formatRelativeTime(report.createdAt)}
              </p>
            </div>

            {/* Status */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-1">Status</h3>
              <p className="text-gray-900 capitalize">
                {report.status.replace('_', ' ')}
              </p>
            </div>

            {/* Verification info */}
            {report.verifiedAt && (
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-1">
                  Verified
                </h3>
                <p className="text-gray-600 text-sm">
                  {formatRelativeTime(report.verifiedAt)}
                </p>
              </div>
            )}

            {/* Resolution info */}
            {report.resolvedAt && (
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-1">
                  Resolved
                </h3>
                <p className="text-gray-600 text-sm">
                  {formatRelativeTime(report.resolvedAt)}
                </p>
                {report.resolutionNotes && (
                  <p className="text-gray-900 text-sm mt-1">
                    {report.resolutionNotes}
                  </p>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 pt-4 border-t border-gray-200">
              <Button
                variant="primary"
                onClick={handleViewInFeed}
                className="flex-1 flex items-center justify-center gap-2"
                data-testid="view-in-feed-button"
              >
                <span>View in Feed</span>
                <ExternalLink className="w-4 h-4" />
              </Button>
              <Button
                variant="secondary"
                onClick={onClose}
                className="flex-1"
                data-testid="close-modal-button"
              >
                Close
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}
