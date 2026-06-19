import { Bell, MapPin } from 'lucide-react'
import { getFreshnessPresentation } from '../../utils/status-registry.js'

const MINUTE_MS = 60_000
const HOUR_MS = 60 * MINUTE_MS
const DAY_MS = 24 * HOUR_MS

interface HomeHeaderProps {
  locationLabel?: string
  now: number
  onOpenAlerts: () => void
  unreadAlertCount: number
  updatedAt?: number
}

function greeting(now: number): string {
  const hour = new Date(now).getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

function timeAgo(timestamp: number, now: number): string {
  const elapsed = Math.max(0, now - timestamp)
  if (elapsed < MINUTE_MS) return 'just now'

  const unit =
    elapsed < HOUR_MS
      ? { divisor: MINUTE_MS, label: 'minute' }
      : elapsed < DAY_MS
        ? { divisor: HOUR_MS, label: 'hour' }
        : { divisor: DAY_MS, label: 'day' }
  const value = Math.floor(elapsed / unit.divisor)
  return `${String(value)} ${unit.label}${value === 1 ? '' : 's'} ago`
}

export function HomeHeader({
  locationLabel,
  now,
  onOpenAlerts,
  unreadAlertCount,
  updatedAt,
}: HomeHeaderProps) {
  const hasUnread = unreadAlertCount > 0
  const badgeColor = getFreshnessPresentation('current').colorToken
  const bellLabel = hasUnread ? `Open alerts, ${String(unreadAlertCount)} unread` : 'Open alerts'

  return (
    <header className="border-b border-surface-200 px-5 pb-5 pt-6">
      <div className="flex min-h-[2.75rem] items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="m-0 text-xl font-bold leading-tight text-surface-900">{greeting(now)}</p>
          {locationLabel ? (
            <p className="mt-2 flex items-center gap-1.5 text-sm font-medium text-surface-700">
              <MapPin size={15} aria-hidden="true" />
              <span>{locationLabel}</span>
            </p>
          ) : null}
          {updatedAt ? (
            <p className="mt-1 text-xs font-medium text-surface-500">
              Updated {timeAgo(updatedAt, now)}
            </p>
          ) : null}
        </div>
        <button
          type="button"
          aria-label={bellLabel}
          data-alert-badge-host
          onClick={onOpenAlerts}
          className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-surface-700 active:bg-surface-100"
        >
          <Bell size={22} aria-hidden="true" />
          {hasUnread ? (
            <span
              data-testid="home-alert-badge"
              className="badge-shake absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-bold text-white"
              style={{ backgroundColor: badgeColor }}
            >
              {unreadAlertCount > 9 ? '9+' : String(unreadAlertCount)}
            </span>
          ) : null}
        </button>
      </div>
    </header>
  )
}
