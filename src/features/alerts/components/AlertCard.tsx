/**
 * AlertCard Component
 *
 * Displays a single government emergency alert.
 * Features severity indicator, timestamp, and optional "Read More" link.
 */

import { useState } from 'react'
import { ExternalLink, Info, AlertTriangle, Cloud, Heart, AlertOctagon } from 'lucide-react'
import type { Alert } from '@/shared/types/firestore.types'
import { formatTimeAgo } from '@/shared/utils/formatTimeAgo'

export interface AlertCardProps {
  alert: Alert
  /** Whether this alert was loaded from cache (offline) */
  isCached?: boolean
}

const SEVERITY_ICON: Record<Alert['severity'], React.ElementType> = {
  info: Info,
  warning: AlertTriangle,
  emergency: AlertTriangle,
}

const SEVERITY_LABEL: Record<Alert['severity'], string> = {
  info: 'info',
  warning: 'warning',
  emergency: 'emergency',
}

const SEVERITY_BORDER: Record<Alert['severity'], string> = {
  info: 'border-blue-400',
  warning: 'border-orange-400',
  emergency: 'border-red-500',
}

const SEVERITY_COLOR: Record<Alert['severity'], string> = {
  info: 'text-blue-500',
  warning: 'text-orange-500',
  emergency: 'text-red-500',
}

const TYPE_ICON: Record<string, React.ElementType> = {
  evacuation: AlertTriangle,
  weather: Cloud,
  health: Heart,
  infrastructure: AlertOctagon,
  other: Info,
}

const SOURCE_BADGE_COLOR: Record<string, string> = {
  MDRRMO: 'bg-red-100 text-red-800',
  PAGASA: 'bg-blue-100 text-blue-800',
  DOH: 'bg-green-100 text-green-800',
  DPWH: 'bg-yellow-100 text-yellow-800',
  PHIVOLCS: 'bg-orange-100 text-orange-800',
  Other: 'bg-gray-100 text-gray-800',
}

export function AlertCard({ alert, isCached = false }: AlertCardProps) {
  const { title, message, severity, createdAt, linkUrl, type, source, sourceUrl, affectedAreas } = alert
  const [isExpanded, setIsExpanded] = useState(false)

  // Truncate long messages
  const TRUNCATE_LENGTH = 150
  const shouldTruncate = message.length > TRUNCATE_LENGTH
  const displayMessage = isExpanded || !shouldTruncate
    ? message
    : message.slice(0, TRUNCATE_LENGTH) + '...'

  const handleLinkClick = () => {
    if (linkUrl) {
      window.open(linkUrl, '_blank', 'noopener,noreferrer')
    }
  }

  return (
    <div
      className={`bg-white rounded-lg shadow-sm border-l-4 ${SEVERITY_BORDER[severity]} p-4`}
      data-testid={`alert-card-${alert.id}`}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          {(() => {
            const IconComponent = SEVERITY_ICON[severity]
            return (
              <IconComponent
                className={`w-4 h-4 ${SEVERITY_COLOR[severity]}`}
                aria-label={`severity-${severity}`}
              />
            )
          })()}
          {type && (() => {
            const TypeIcon = TYPE_ICON[type]
            return (
              <TypeIcon
                className="w-4 h-4 text-gray-500"
                aria-label={`type-${type}`}
                aria-hidden="true"
              />
            )
          })()}
          <h3 className="font-bold text-gray-900 text-sm leading-tight">{title}</h3>
        </div>
        <span className="text-xs text-gray-500 whitespace-nowrap flex-shrink-0">
          {formatTimeAgo(createdAt)}
          {isCached && (
            <span className="ml-1 text-gray-400" data-testid="cached-indicator">(cached)</span>
          )}
        </span>
      </div>

      {/* Source badge */}
      {source && (
        <div className="mb-2">
          {sourceUrl ? (
            <a
              href={sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => window.open(sourceUrl, '_blank', 'noopener,noreferrer')}
              className={`inline-block px-2 py-0.5 text-xs font-medium rounded ${SOURCE_BADGE_COLOR[source] ?? SOURCE_BADGE_COLOR['Other']}`}
            >
              {source}
            </a>
          ) : (
            <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded ${SOURCE_BADGE_COLOR[source] ?? SOURCE_BADGE_COLOR['Other']}`}>
              {source}
            </span>
          )}
        </div>
      )}

      <p className="text-gray-700 text-sm leading-relaxed mb-2">{displayMessage}</p>

      {/* Affected areas */}
      {affectedAreas && (
        <p className="text-xs text-gray-500 mb-2">
          Affects: {affectedAreas.municipalities.join(', ')}
          {(affectedAreas.barangays ?? []).length > 0 && (
            <> ({affectedAreas.barangays!.join(', ')})</>
          )}
        </p>
      )}

      {/* See more / See less button */}
      {shouldTruncate && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-primary-blue text-sm font-medium hover:underline mb-2"
          data-testid="see-more-button"
        >
          {isExpanded ? 'See less' : 'See more'}
        </button>
      )}

      {/* Read More link */}
      {linkUrl && (
        <button
          onClick={handleLinkClick}
          className="flex items-center gap-1 text-sm text-gray-600 hover:text-primary-blue transition-colors"
          data-testid="read-more-link"
        >
          <span>Read More</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  )
}

