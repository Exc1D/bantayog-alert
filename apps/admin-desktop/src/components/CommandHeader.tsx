import { Bell, Keyboard, Map, Volume2, VolumeX } from 'lucide-react'
import { LiveIndicator } from './LiveIndicator'

type WindowRole = 'dashboard' | 'map'

interface Props {
  title: string
  windowRole?: string
  lastUpdatedAt: number
  notificationCount?: number
  audioEnabled?: boolean
  onToggleAudio?: () => void
  onOpenMap?: () => void
  onShowNotifications?: () => void
  onShowKeyboardShortcuts?: () => void
  windowRole?: WindowRole
}

const ROLE_ACCENT: Record<WindowRole, string> = {
  dashboard: 'var(--color-danger)',
  map: 'var(--color-info)',
}

const ROLE_LABEL: Record<WindowRole, string> = {
  dashboard: 'Dashboard',
  map: 'Map',
}

export function CommandHeader({
  title,
  lastUpdatedAt,
  notificationCount = 0,
  audioEnabled,
  onToggleAudio,
  onOpenMap,
  onShowNotifications,
  onShowKeyboardShortcuts,
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
        <LiveIndicator lastUpdatedAt={lastUpdatedAt} />
        {onToggleAudio && (
          <button
            onClick={onToggleAudio}
            aria-label={audioEnabled ? 'Mute audio alerts' : 'Enable audio alerts'}
            className="rounded-md p-2 hover:bg-white/10"
          >
            {audioEnabled ? (
              <Volume2 className="h-4 w-4 text-[var(--color-success)]" />
            ) : (
              <VolumeX className="h-4 w-4 text-white/50" />
            )}
          </button>
        )}
        {onShowNotifications && (
          <button
            onClick={onShowNotifications}
            className="relative rounded-md p-2 hover:bg-white/10"
            aria-label={`${String(notificationCount)} notifications`}
          >
            <Bell className="h-5 w-5 text-[var(--color-text-secondary)]" />
            {notificationCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--color-sienna)] text-[10px] text-white">
                {notificationCount}
              </span>
            )}
          </button>
        )}
        {onShowKeyboardShortcuts && (
          <button
            onClick={onShowKeyboardShortcuts}
            className="flex items-center gap-1.5 rounded-md border border-white/10 px-2.5 py-1.5 text-xs text-[var(--color-text-secondary)] hover:bg-white/5"
            aria-label="Keyboard shortcuts"
            title="Press ? for shortcuts"
          >
            <Keyboard className="h-3.5 w-3.5" />
            Shortcuts
          </button>
        )}
        {onOpenMap && (
          <button
            onClick={onOpenMap}
            className="flex items-center gap-2 rounded-md bg-[var(--color-danger)] px-3 py-1.5 text-sm text-white hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-danger)]"
          >
            <Map className="h-4 w-4" />
            Open Map Window
          </button>
        )}
      </div>
    </header>
  )
}
