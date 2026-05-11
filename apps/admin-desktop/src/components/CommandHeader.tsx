import { Bell, Map, Volume2, VolumeX } from 'lucide-react'
import { LiveIndicator } from './LiveIndicator'

interface Props {
  title: string
  lastUpdatedAt: number
  notificationCount?: number
  audioEnabled?: boolean
  onToggleAudio?: () => void
  onOpenMap?: () => void
  onShowNotifications?: () => void
}

export function CommandHeader({
  title,
  lastUpdatedAt,
  notificationCount = 0,
  audioEnabled,
  onToggleAudio,
  onOpenMap,
  onShowNotifications,
}: Props) {
  return (
    <header className="flex items-center justify-between border-b border-[var(--color-surface)] bg-[var(--color-surface)] px-4 py-3">
      <div className="flex items-center gap-3">
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
