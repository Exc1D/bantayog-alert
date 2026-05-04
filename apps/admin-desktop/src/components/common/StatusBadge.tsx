import { cn } from '@/lib/utils'

type StatusType = 'ACTIVE' | 'PENDING' | 'CRITICAL' | 'RESOLVED' | 'ESCALATED'

const statusStyles: Record<StatusType, { bg: string; text: string; border: string }> = {
  ACTIVE: { bg: 'bg-green-50', text: 'text-green-800', border: 'border-green-200' },
  PENDING: { bg: 'bg-amber-50', text: 'text-amber-800', border: 'border-amber-200' },
  CRITICAL: { bg: 'bg-red-50', text: 'text-red-800', border: 'border-red-200' },
  RESOLVED: { bg: 'bg-gray-50', text: 'text-gray-600', border: 'border-gray-200' },
  ESCALATED: { bg: 'bg-purple-50', text: 'text-purple-800', border: 'border-purple-200' },
}

interface StatusBadgeProps {
  status: string
  className?: string
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const normalizedStatus = status.trim().toUpperCase()
  const statusKey: StatusType =
    normalizedStatus === 'ACTIVE' ||
    normalizedStatus === 'PENDING' ||
    normalizedStatus === 'CRITICAL' ||
    normalizedStatus === 'RESOLVED' ||
    normalizedStatus === 'ESCALATED'
      ? normalizedStatus
      : 'PENDING'
  const styles = statusStyles[statusKey]
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border',
        styles.bg,
        styles.text,
        styles.border,
        className,
      )}
    >
      {statusKey}
    </span>
  )
}
