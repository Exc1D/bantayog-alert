/**
 * AlertCard Component
 *
 * Displays a single government emergency alert.
 * Uses the shared Alert type from Firestore and shared formatTimeAgo utility.
 */

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
  const { title, message, severity, createdAt } = alert

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
      <p className="text-gray-700 text-sm leading-relaxed">{message}</p>
    </div>
  )
}
