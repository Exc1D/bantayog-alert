/**
 * AlertCard Component
 *
 * Displays a single government emergency alert.
 * Features severity indicator, timestamp, and optional "Read More" link.
 */

import { useState } from 'react'
import { ExternalLink } from 'lucide-react'
import type { Alert } from '@/shared/types/firestore.types'
import { formatTimeAgo } from '@/shared/utils/formatTimeAgo'

export interface AlertCardProps {
  alert: Alert
}

const SEVERITY_ICON: Record<Alert['severity'], string> = {
  info: 'ℹ️',
  warning: '⚠️',
  emergency: '🔴',
}

const SEVERITY_BORDER: Record<Alert['severity'], string> = {
  info: 'border-blue-400',
  warning: 'border-orange-400',
  emergency: 'border-red-500',
}

export function AlertCard({ alert }: AlertCardProps) {
  const { title, message, severity, createdAt, linkUrl } = alert
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
          <span aria-label={`severity-${severity}`} role="img">
            {SEVERITY_ICON[severity]}
          </span>
          <h3 className="font-bold text-gray-900 text-sm leading-tight">{title}</h3>
        </div>
        <span className="text-xs text-gray-500 whitespace-nowrap flex-shrink-0">
          {formatTimeAgo(createdAt)}
        </span>
      </div>

      <p className="text-gray-700 text-sm leading-relaxed mb-2">{displayMessage}</p>

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

