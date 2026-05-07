import { cn } from '@/lib/utils'
import { ArrowUp, ArrowDown } from 'lucide-react'

interface MetricCardProps {
  title: string
  value: string
  subtitle?: string
  trend?: { value: string; direction: 'up' | 'down'; positive: boolean }
  live?: boolean
  children?: React.ReactNode
  className?: string
  onClick?: () => void
}

export function MetricCard({
  title,
  value,
  subtitle,
  trend,
  live,
  children,
  className,
  onClick,
}: MetricCardProps) {
  const interactive = onClick
    ? {
        role: 'button' as const,
        tabIndex: 0,
        onClick,
        onKeyDown: (e: React.KeyboardEvent) => {
          if (e.key === 'Enter' || e.key === ' ') onClick()
        },
      }
    : {}

  return (
    <div
      className={cn(
        'relative bg-white border border-border rounded-lg p-5 transition-all duration-200 hover:shadow-md',
        onClick && 'cursor-pointer',
        className,
      )}
      {...interactive}
    >
      {live && (
        <div className="absolute top-4 right-4" role="status" aria-label="Live data indicator">
          <span className="relative flex h-2 w-2">
            <span className="motion-safe:animate-pulse-ring absolute inline-flex h-full w-full rounded-full bg-green-600 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-600" />
          </span>
        </div>
      )}
      <p className="text-xs text-muted-foreground uppercase tracking-wider">{title}</p>
      <p className="text-[36px] font-mono text-foreground mt-2 leading-tight font-bold">{value}</p>
      {subtitle && <p className="text-sm text-muted-foreground/70 mt-1">{subtitle}</p>}
      {trend && (
        <div
          className={cn(
            'flex items-center gap-1 mt-2 text-xs',
            trend.positive ? 'text-green-700' : 'text-red-700',
          )}
        >
          {trend.direction === 'up' ? (
            <ArrowUp className="w-3 h-3" />
          ) : (
            <ArrowDown className="w-3 h-3" />
          )}
          <span>{trend.value}</span>
        </div>
      )}
      {children}
    </div>
  )
}
