/**
 * AlertDetailModal Component
 *
 * Displays full details of a government emergency alert.
 * Used when a user clicks on an alert card to see the full message.
 */

import { Modal } from '@/shared/components/Modal'
import { ExternalLink, Share2, Info, AlertTriangle, Cloud, Heart, AlertOctagon } from 'lucide-react'
import { formatTimeAgo } from '@/shared/utils/formatTimeAgo'
import type { Alert } from '@/shared/types/firestore.types'

export interface AlertDetailModalProps {
  alert: Alert
  isOpen: boolean
  onClose: () => void
  /** Optional override for the modal title */
  title?: string
}

const SEVERITY_LABEL: Record<Alert['severity'], string> = {
  info: 'info',
  warning: 'warning',
  emergency: 'emergency',
}

const SEVERITY_COLOR: Record<Alert['severity'], string> = {
  info: 'bg-blue-100 text-blue-800',
  warning: 'bg-orange-100 text-orange-800',
  emergency: 'bg-red-100 text-red-800',
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

/**
 * Modal displaying full government alert details.
 *
 * @param alert - The Alert object to display
 * @param isOpen - Whether the modal is visible
 * @param onClose - Callback to close the modal
 * @param title - Optional title (defaults to alert title)
 */
export function AlertDetailModal({
  alert,
  isOpen,
  onClose,
  title,
}: AlertDetailModalProps) {
  const {
    title: alertTitle,
    message,
    severity,
    createdAt,
    linkUrl,
    type,
    source,
    sourceUrl,
    affectedAreas,
  } = alert

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: alertTitle,
          text: message,
          url: linkUrl ?? window.location.href,
        })
      } catch (error: unknown) {
        // AbortError means the user dismissed the share sheet — not a real failure
        if (!(error instanceof Error) || error.name !== 'AbortError') {
          console.error('Share failed:', error)
        }
      }
    } else if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(linkUrl ?? window.location.href)
      } catch (error: unknown) {
        console.error('Clipboard write failed:', error)
      }
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title ?? alertTitle}
    >
      <div className="space-y-4" data-testid="alert-detail-modal">
        {/* Severity and Type badges */}
        <div className="flex flex-wrap gap-2">
          <span
            className={`px-3 py-1 rounded-full text-sm font-medium ${SEVERITY_COLOR[severity]}`}
          >
            {SEVERITY_LABEL[severity].toUpperCase()}
          </span>
          {type && (
            <span className="px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-700 flex items-center gap-1">
              {(() => {
                const TypeIcon = TYPE_ICON[type] ?? Info
                return <TypeIcon className="w-4 h-4" aria-hidden="true" />
              })()}
              {type.charAt(0).toUpperCase() + type.slice(1)}
            </span>
          )}
        </div>

        {/* Timestamp */}
        <p className="text-sm text-gray-500">{formatTimeAgo(createdAt)}</p>

        {/* Full message */}
        <p className="text-gray-900 leading-relaxed">{message}</p>

        {/* Affected Areas */}
        {affectedAreas && (
          <div className="bg-gray-50 rounded-lg p-3">
            <h4 className="text-sm font-semibold text-gray-700 mb-1">Affected Areas</h4>
            <p className="text-sm text-gray-700">
              Municipalities: {affectedAreas.municipalities.join(', ')}
            </p>
            {(affectedAreas.barangays ?? []).length > 0 && (
              <p className="text-sm text-gray-600 mt-1">
                Barangays: {affectedAreas.barangays?.join(', ')}
              </p>
            )}
          </div>
        )}

        {/* Source Attribution */}
        {source && (
          <div>
            <h4 className="text-sm font-semibold text-gray-700 mb-1">Source</h4>
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={`inline-block px-2 py-0.5 text-xs font-medium rounded ${SOURCE_BADGE_COLOR[source] ?? SOURCE_BADGE_COLOR['Other']}`}
              >
                {source}
              </span>
              {sourceUrl && (
                <a
                  href={sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-sm text-primary-blue hover:underline"
                  data-testid="source-link"
                >
                  View official source
                  <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                </a>
              )}
            </div>
          </div>
        )}

        {/* Read More link */}
        {linkUrl && (
          <a
            href={linkUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-sm text-gray-600 hover:text-primary-blue transition-colors"
            data-testid="read-more-link"
          >
            <span>Read More</span>
            <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
          </a>
        )}

        {/* Share Button */}
        <div className="flex gap-2 pt-2 border-t border-gray-200">
          <button
            onClick={handleShare}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors text-sm font-medium"
            data-testid="share-button"
          >
            <Share2 className="w-4 h-4" aria-hidden="true" />
            Share Alert
          </button>
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors text-sm font-medium"
            data-testid="close-button"
          >
            Close
          </button>
        </div>
      </div>
    </Modal>
  )
}
