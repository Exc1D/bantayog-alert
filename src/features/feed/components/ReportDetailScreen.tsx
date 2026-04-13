/**
 * ReportDetailScreen Component
 *
 * Displays full report details with status timeline.
 * Fetches report from Firestore and builds timeline from status history.
 */

import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Share2,
  MapPin,
  Clock,
  CheckCircle,
  AlertCircle,
} from 'lucide-react'
import { Report } from '@/shared/types/firestore.types'
import { getDocument } from '@/shared/services/firestore.service'
import { formatTimeAgo } from '@/shared/utils/formatTimeAgo'
import { UpdateTimeline, TimelineEntry } from './UpdateTimeline'
import { StatusBadge } from '@/shared/components/StatusBadge'
import { formatReportType } from '../utils/feedHelpers'
import { BeforeAfterGallery } from './BeforeAfterGallery'

interface ReportDetailState {
  report: Report | null
  isLoading: boolean
  error: string | null
}

/**
 * Builds timeline entries from report status history
 */
function buildTimelineEntries(report: Report): TimelineEntry[] {
  const entries: TimelineEntry[] = []

  // Report submitted
  entries.push({
    id: 'submitted',
    timestamp: new Date(report.createdAt),
    type: 'submitted',
    description: 'Report submitted',
    actor: report.isAnonymous ? 'Anonymous Citizen' : 'Citizen Reporter',
  })

  // Verified
  if (report.verifiedAt) {
    entries.push({
      id: 'verified',
      timestamp: new Date(report.verifiedAt),
      type: 'verified',
      description: 'Report verified by admin',
    })
  }

  // Resolved
  if (report.resolvedAt) {
    entries.push({
      id: 'resolved',
      timestamp: new Date(report.resolvedAt),
      type: 'resolved',
      description: report.resolutionNotes || 'Report resolved',
    })
  }

  return entries
}

/**
 * Severity badge color
 */
function getSeverityColor(severity: string): string {
  const DEFAULT_COLOR = 'bg-gray-100 text-gray-800'
  const colors: Record<string, string> = {
    low: 'bg-gray-100 text-gray-800',
    medium: 'bg-yellow-100 text-yellow-800',
    high: 'bg-orange-100 text-orange-800',
    critical: 'bg-red-100 text-red-800',
  }
  const color = colors[severity]
  return color !== undefined ? color : DEFAULT_COLOR
}

/**
 * Incident type badge color
 */
function getTypeColor(type: string): string {
  const DEFAULT_COLOR = 'bg-gray-100 text-gray-800'
  const colors: Record<string, string> = {
    flood: 'bg-blue-100 text-blue-800',
    earthquake: 'bg-amber-100 text-amber-800',
    landslide: 'bg-yellow-100 text-yellow-800',
    fire: 'bg-red-100 text-red-800',
    typhoon: 'bg-cyan-100 text-cyan-800',
    medical_emergency: 'bg-pink-100 text-pink-800',
    accident: 'bg-orange-100 text-orange-800',
    infrastructure: 'bg-gray-100 text-gray-800',
    crime: 'bg-purple-100 text-purple-800',
    other: 'bg-gray-100 text-gray-800',
  }
  const color = colors[type]
  return color !== undefined ? color : DEFAULT_COLOR
}

export function ReportDetailScreen() {
  const { reportId } = useParams<{ reportId: string }>()
  const navigate = useNavigate()

  const [state, setState] = useState<ReportDetailState>({
    report: null,
    isLoading: true,
    error: null,
  })

  useEffect(() => {
    async function fetchReport() {
      if (!reportId) {
        setState({ report: null, isLoading: false, error: 'No report ID provided' })
        return
      }

      try {
        const report = await getDocument<Report>('reports', reportId)
        if (report) {
          setState({ report, isLoading: false, error: null })
        } else {
          setState({ report: null, isLoading: false, error: 'Report not found' })
        }
      } catch (err) {
        setState({ report: null, isLoading: false, error: 'Failed to load report' })
      }
    }

    fetchReport()
  }, [reportId])

  // Loading state
  if (state.isLoading) {
    return (
      <div className="min-h-screen bg-gray-50" data-testid="report-detail-screen">
        <div className="flex items-center justify-center h-64">
          <div className="flex flex-col items-center gap-3" data-testid="report-detail-loading">
            <div className="w-10 h-10 border-4 border-primary-blue border-t-transparent rounded-full animate-spin" />
            <span className="text-gray-500">Loading report...</span>
          </div>
        </div>
      </div>
    )
  }

  // Error state
  if (state.error || !state.report) {
    return (
      <div className="min-h-screen bg-gray-50" data-testid="report-detail-screen">
        <div className="flex flex-col items-center justify-center h-64 gap-4" data-testid="report-detail-error">
          <AlertCircle className="w-12 h-12 text-red-400" />
          <h2 className="text-lg font-semibold text-gray-900">Report Not Found</h2>
          <p className="text-gray-500">{state.error || "The report you're looking for doesn't exist."}</p>
          <button
            onClick={() => navigate('/feed')}
            className="mt-4 px-4 py-2 bg-primary-blue text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            Back to Feed
          </button>
        </div>
      </div>
    )
  }

  const { report } = state
  const timelineEntries = buildTimelineEntries(report)
  const typeDisplay = formatReportType(report.incidentType)
  const locationDisplay = `${report.approximateLocation.barangay}, ${report.approximateLocation.municipality}`

  // Handle share
  const handleShare = async () => {
    const shareUrl = window.location.href

    if (navigator.share) {
      try {
        await navigator.share({
          title: `${typeDisplay} Report`,
          text: report.description,
          url: shareUrl,
        })
      } catch (error) {
        if (!(error instanceof Error) || error.name !== 'AbortError') {
          console.error('Share failed:', error)
        }
      }
    } else if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(shareUrl)
      } catch (error) {
        console.error('Clipboard write failed:', error)
      }
    }
  }

  return (
    <div className="min-h-screen bg-gray-50" data-testid="report-detail-screen">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/feed')}
              className="p-2 -ml-2 rounded-lg hover:bg-gray-100 transition-colors"
              aria-label="Back to feed"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
            <h1 className="text-lg font-semibold text-gray-900">Report Details</h1>
            <div className="flex-1" />
            <button
              onClick={handleShare}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
              aria-label="Share report"
              data-testid="share-button"
            >
              <Share2 className="w-5 h-5 text-gray-600" />
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* Report Card */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden mb-6">
          {/* Header Section */}
          <div className="p-4 pb-3">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                {/* Avatar */}
                <div className="w-12 h-12 bg-primary-blue rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-white font-semibold text-lg">
                    {typeDisplay.charAt(0)}
                  </span>
                </div>

                {/* User info */}
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-900">
                      {report.isAnonymous ? 'Anonymous Citizen' : 'Citizen Reporter'}
                    </span>
                    {report.verifiedAt && (
                      <CheckCircle
                        className="w-5 h-5 text-green-500"
                        data-testid="verified-badge"
                      />
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <Clock className="w-3.5 h-3.5" />
                    <span>{formatTimeAgo(report.createdAt)}</span>
                  </div>
                </div>
              </div>

              {/* Status and severity */}
              <div className="flex flex-col items-end gap-2">
                <StatusBadge status={report.status} />
                <span
                  className={`text-xs font-bold px-2 py-1 rounded ${getSeverityColor(report.severity)}`}
                >
                  {report.severity.toUpperCase()}
                </span>
              </div>
            </div>

            {/* Type badge */}
            <span
              className={`inline-block text-sm font-medium px-3 py-1 rounded-full mb-3 ${getTypeColor(report.incidentType)}`}
            >
              {typeDisplay}
            </span>

            {/* Description */}
            <p className="text-gray-800 leading-relaxed mb-4">
              {report.description}
            </p>

            {/* Location */}
            <div className="flex items-center gap-2 text-sm text-gray-600 mb-4">
              <MapPin className="w-4 h-4" />
              <span>{locationDisplay}</span>
            </div>

            {/* Photos */}
            {(report as any).photoUrls && (report as any).photoUrls.length > 0 && (
              <div className="mb-4 -mx-4">
                <img
                  src={(report as any).photoUrls[0]}
                  alt={`Report photo for ${typeDisplay}`}
                  className="w-full h-64 object-cover"
                />
              </div>
            )}

            {/* Resolution notes */}
            {report.resolutionNotes && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
                <p className="text-sm font-medium text-green-800 mb-1">Resolution</p>
                <p className="text-sm text-green-700">{report.resolutionNotes}</p>
              </div>
            )}

            {/* Before/After Gallery for resolved reports */}
            {report.status === 'resolved' && (report as any).photoUrls && (report as any).photoUrls.length > 0 && (
              <div className="mt-4">
                <h4 className="text-sm font-medium text-gray-700 mb-3">Photo Documentation</h4>
                <BeforeAfterGallery
                  photos={{
                    // Currently using existing photoUrls as "after" photos
                    // TODO: Add beforePhotoUrls field to Report type for proper before/after comparison
                    before: [],
                    after: (report as any).photoUrls,
                  }}
                />
              </div>
            )}
          </div>
        </div>

        {/* Timeline Section */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200">
            <h2 className="font-semibold text-gray-900">Status Timeline</h2>
          </div>
          <div className="p-4">
            <UpdateTimeline entries={timelineEntries} />
          </div>
        </div>
      </div>
    </div>
  )
}
