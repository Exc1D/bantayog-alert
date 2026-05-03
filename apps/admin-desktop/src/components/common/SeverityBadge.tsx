import { cn } from '@/lib/utils'

type SeverityType = 'HIGH' | 'MEDIUM' | 'LOW'

const severityStyles: Record<SeverityType, { bg: string; text: string; border: string }> = {
  HIGH: { bg: 'bg-red-50', text: 'text-red-800', border: 'border-red-200' },
  MEDIUM: { bg: 'bg-amber-50', text: 'text-amber-800', border: 'border-amber-200' },
  LOW: { bg: 'bg-green-50', text: 'text-green-800', border: 'border-green-200' },
}

interface SeverityBadgeProps {
  severity: string
  className?: string
}

export function SeverityBadge({ severity, className }: SeverityBadgeProps) {
  const styles =
    severity in severityStyles ? severityStyles[severity as SeverityType] : severityStyles.LOW
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
      {severity}
    </span>
  )
}
