/**
 * FeedCard Component
 *
 * Facebook-style card for displaying individual reports in the feed timeline.
 */

import { useState, useEffect } from 'react'
import { MapPin, Heart, Share2, CheckCircle2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Report } from '@/shared/types/firestore.types'
import { StatusBadge } from '@/shared/components/StatusBadge'
import { FeedCardActions } from '../types'
import { truncateText, formatReportType, formatTimeAgo } from '../utils/feedHelpers'

export interface FeedCardProps {
  report: Report
  actions?: FeedCardActions
  isLiked?: boolean
  likeCount?: number
}

export function FeedCard({ report, actions, isLiked = false, likeCount = 0 }: FeedCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [liked, setLiked] = useState(isLiked)
  const navigate = useNavigate()

  // Re-sync like state when parent refreshes (e.g. pull-to-refresh)
  useEffect(() => {
    setLiked(isLiked)
  }, [isLiked])

  // Description truncation
  const shouldTruncate = report.description.length > 150
  const displayDescription = isExpanded || !shouldTruncate
    ? report.description
    : truncateText(report.description, 150)

  // Handle location click
  const handleLocationClick = () => {
    const { latitude, longitude } = report.approximateLocation.approximateCoordinates
    if (actions?.onLocationClick) {
      actions.onLocationClick(latitude, longitude)
    } else {
      // Default navigation to map
      navigate(`/map?lat=${latitude}&lng=${longitude}`)
    }
  }

  // Handle like
  const handleLike = () => {
    setLiked(!liked)
    actions?.onLike?.(report.id)
  }

  // Handle share
  const handleShare = async () => {
    actions?.onShare?.(report.id)

    // Fallback: copy link to clipboard
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${formatReportType(report.incidentType)} Report`,
          text: report.description,
          url: window.location.href,
        })
      } catch (error) {
        // AbortError means the user dismissed the share sheet — not a real failure
        if (!(error instanceof Error) || error.name !== 'AbortError') {
          console.error('Share failed:', error)
        }
      }
    } else if (navigator.clipboard && navigator.clipboard.writeText) {
      // Copy to clipboard fallback
      try {
        await navigator.clipboard.writeText(window.location.href)
      } catch (error) {
        console.error('Clipboard write failed:', error)
      }
    }
  }

  // Severity badge color
  const getSeverityColor = (severity: string): string => {
    const colors = {
      low: 'bg-gray-100 text-gray-800',
      medium: 'bg-yellow-100 text-yellow-800',
      high: 'bg-orange-100 text-orange-800',
      critical: 'bg-red-100 text-red-800',
    }
    return colors[severity as keyof typeof colors] || colors.low
  }

  // Incident type badge color
  const getTypeColor = (type: string): string => {
    const colors = {
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
    return colors[type as keyof typeof colors] || colors.other
  }

  const typeDisplay = formatReportType(report.incidentType)

  return (
    <div
      className="bg-white rounded-lg shadow-sm overflow-hidden"
      data-testid={`feed-card-${report.id}`}
    >
      {/* Card Header */}
      <div className="p-4 pb-3">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            {/* Avatar */}
            <div className="w-10 h-10 bg-primary-blue rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-white font-semibold text-sm">
                {typeDisplay.charAt(0)}
              </span>
            </div>

            {/* User info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-gray-900 text-sm">
                  {report.isAnonymous ? 'Anonymous Citizen' : 'Citizen Reporter'}
                </span>
                {report.verifiedAt && (
                  <CheckCircle2
                    className="w-4 h-4 text-status-verified"
                    data-testid="verified-badge"
                  />
                )}
              </div>
              <div className="text-xs text-gray-500">
                {formatTimeAgo(report.createdAt)} · {report.approximateLocation.barangay}, {report.approximateLocation.municipality}
              </div>
            </div>
          </div>

          {/* Status and severity badges */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <StatusBadge status={report.status} />
            <span
              className={`text-xs font-bold px-2 py-1 rounded ${getSeverityColor(report.severity)}`}
              data-testid="severity-badge"
            >
              {report.severity.toUpperCase()}
            </span>
          </div>
        </div>

        {/* Content section */}
        <div className="mb-3">
          {/* Type badge */}
          <span
            className={`inline-block text-xs font-medium px-2 py-1 rounded mb-2 ${getTypeColor(report.incidentType)}`}
            data-testid="type-badge"
          >
            {typeDisplay}
          </span>

          {/* Description */}
          <p className="text-gray-800 text-sm leading-relaxed" data-testid="report-description">
            {displayDescription}
          </p>

          {/* See more button */}
          {shouldTruncate && !isExpanded && (
            <button
              onClick={() => setIsExpanded(true)}
              className="text-primary-blue text-sm font-medium mt-1 hover:underline"
              data-testid="see-more-button"
            >
              See more
            </button>
          )}

          {/* See less button */}
          {isExpanded && shouldTruncate && (
            <button
              onClick={() => setIsExpanded(false)}
              className="text-primary-blue text-sm font-medium mt-1 hover:underline"
              data-testid="see-less-button"
            >
              See less
            </button>
          )}
        </div>

        {/* Photo section (if available) */}
        {report.photoUrls && report.photoUrls.length > 0 && (
          <div className="mb-3 -mx-4">
            <img
              src={report.photoUrls[0]}
              alt={`Report photo for ${typeDisplay}`}
              className="w-full h-64 object-cover"
              loading="lazy"
              data-testid="report-photo"
            />
          </div>
        )}
      </div>

      {/* Card Footer */}
      <div className="px-4 py-3 border-t border-gray-100">
        <div className="flex items-center justify-between mb-3">
          {/* Location */}
          <button
            onClick={handleLocationClick}
            className="flex items-center gap-1 text-xs text-gray-600 hover:text-primary-blue transition-colors"
            data-testid="location-button"
          >
            <MapPin className="w-3.5 h-3.5" />
            <span className="capitalize">
              {report.approximateLocation.barangay}, {report.approximateLocation.municipality}
            </span>
          </button>

          {/* Action counts */}
          <div className="flex items-center gap-3 text-xs text-gray-500">
            {likeCount > 0 && (
              <span data-testid="like-count">{likeCount}</span>
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          {/* Like button */}
          <button
            onClick={handleLike}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg transition-colors ${
              liked
                ? 'text-red-500 bg-red-50 hover:bg-red-100'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
            data-testid="like-button"
          >
            <Heart className={`w-5 h-5 ${liked ? 'fill-current' : ''}`} />
            <span className="text-sm font-medium">Like</span>
          </button>


          {/* Share button */}
          <button
            onClick={handleShare}
            className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
            data-testid="share-button"
          >
            <Share2 className="w-5 h-5" />
            <span className="text-sm font-medium">Share</span>
          </button>
        </div>
      </div>
    </div>
  )
}
