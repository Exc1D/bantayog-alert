import type { ReportStatus } from '@/shared/types/firestore.types'

interface StatusBadgeProps {
  status: ReportStatus
  text?: string
}

const statusConfig: Record<ReportStatus, { text: string; bg: string }> = {
  pending: { text: 'Pending', bg: 'bg-status-pending' },
  verified: { text: 'Verified', bg: 'bg-status-verified' },
  assigned: { text: 'Assigned', bg: 'bg-blue-500' },
  responding: { text: 'Responding', bg: 'bg-orange-500' },
  resolved: { text: 'Resolved', bg: 'bg-status-resolved' },
  false_alarm: { text: 'False Alarm', bg: 'bg-gray-400' },
}

export function StatusBadge({ status, text }: StatusBadgeProps) {
  const config = statusConfig[status]

  return (
    <span
      className={`inline-block px-3 py-1 rounded-full text-xs font-medium text-white ${config.bg}`}
    >
      {text || config.text}
    </span>
  )
}
