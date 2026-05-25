import {
  AlertTriangle,
  Bell,
  Keyboard,
  LayoutDashboard,
  LogOut,
  Map,
  Newspaper,
  Radio,
  Volume2,
  VolumeX,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { LiveIndicator } from './LiveIndicator'
import { Tooltip } from './Tooltip'

type WindowRole = 'dashboard' | 'map' | 'feed' | 'dispatches'

interface Props {
  title: string
  lastUpdatedAt: number
  notificationCount?: number
  audioEnabled?: boolean
  onToggleAudio?: () => void
  onDeclareAlert?: () => void
  onShowNotifications?: () => void
  onShowKeyboardShortcuts?: () => void
  onSignOut?: () => void
  windowRole?: WindowRole
}

const ROLE_ACCENT: Record<WindowRole, string> = {
  dashboard: 'var(--color-danger)',
  map: 'var(--color-info)',
  feed: 'var(--color-success)',
  dispatches: 'var(--color-warning)',
} as const

const ROLE_LABEL: Record<WindowRole, string> = {
  dashboard: 'Dashboard',
  map: 'Map',
  feed: 'Feed',
  dispatches: 'Dispatches',
} as const

const NAV_ITEMS = [
  { role: 'dashboard', href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { role: 'map', href: '/map', label: 'Map', icon: Map },
  { role: 'feed', href: '/feed', label: 'Feed', icon: Newspaper },
  { role: 'dispatches', href: '/dispatches', label: 'Dispatches', icon: Radio },
] as const

export function CommandHeader({
  title,
  lastUpdatedAt,
  notificationCount = 0,
  audioEnabled,
  onToggleAudio,
  onDeclareAlert,
  onShowNotifications,
  onShowKeyboardShortcuts,
  onSignOut,
  windowRole,
}: Props) {
  return (
    <header className="relative flex items-center justify-between border-b border-[var(--color-surface)] bg-[var(--color-surface)] px-4 py-3">
      {windowRole && (
        <span
          aria-hidden="true"
          data-testid="window-role-accent"
          data-role={windowRole}
          className="absolute left-0 top-0 h-full w-1"
          style={{ backgroundColor: ROLE_ACCENT[windowRole] }}
        />
      )}
      <div className="flex items-center gap-3">
        {windowRole && (
          <span
            data-testid="window-role-chip"
            data-role={windowRole}
            className="rounded-sm border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]"
            style={{ color: ROLE_ACCENT[windowRole] }}
          >
            {ROLE_LABEL[windowRole]}
          </span>
        )}
        <span className="text-lg font-semibold text-[var(--color-text-primary)]">{title}</span>
      </div>
      <div className="flex items-center gap-4">
        {windowRole && (
          <nav
            aria-label="Command center tabs"
            className="flex overflow-hidden rounded border border-white/10"
          >
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon
              const active = windowRole === item.role
              return (
                <Link
                  key={item.role}
                  to={item.href}
                  {...(active ? { 'aria-current': 'page' as const } : {})}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
                  style={{
                    color: active ? ROLE_ACCENT[item.role] : 'var(--color-text-secondary)',
                    backgroundColor: active ? 'rgba(255,255,255,0.06)' : 'transparent',
                  }}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {item.label}
                </Link>
              )
            })}
          </nav>
        )}
        <LiveIndicator lastUpdatedAt={lastUpdatedAt} />
        {onDeclareAlert && (
          <Tooltip content="Create and broadcast a new public emergency alert.">
            <button
              onClick={onDeclareAlert}
              className="flex items-center gap-2 rounded-md bg-[var(--color-danger)] px-3 py-1.5 text-sm text-white hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-danger)]"
            >
              <AlertTriangle className="h-4 w-4" />
              Declare Alert
            </button>
          </Tooltip>
        )}
        {onToggleAudio && (
          <button
            onClick={onToggleAudio}
            aria-label={audioEnabled ? 'Mute audio alerts' : 'Enable audio alerts'}
            className="rounded-md p-2 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
          >
            {audioEnabled ? (
              <Volume2 className="h-4 w-4 text-[var(--color-success)]" />
            ) : (
              <VolumeX className="h-4 w-4 text-[var(--color-text-muted)]" />
            )}
          </button>
        )}
        {onShowNotifications && (
          <button
            onClick={onShowNotifications}
            className="relative rounded-md p-2 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
            aria-label={`${String(notificationCount)} notifications`}
          >
            <Bell className="h-5 w-5 text-[var(--color-text-secondary)]" />
            {notificationCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--color-warning)] text-[10px] text-white">
                {notificationCount}
              </span>
            )}
          </button>
        )}
        {onShowKeyboardShortcuts && (
          <button
            onClick={onShowKeyboardShortcuts}
            className="flex items-center gap-1.5 rounded-md border border-white/10 px-2.5 py-1.5 text-xs text-[var(--color-text-secondary)] hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
            aria-label="Keyboard shortcuts"
            title="Press ? for shortcuts"
          >
            <Keyboard className="h-3.5 w-3.5" />
            Shortcuts
          </button>
        )}
        {onSignOut && (
          <button
            onClick={onSignOut}
            className="rounded-md p-2 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
            aria-label="Sign out"
            title="Sign out"
          >
            <LogOut className="h-4 w-4 text-[var(--color-text-muted)]" />
          </button>
        )}
      </div>
    </header>
  )
}
