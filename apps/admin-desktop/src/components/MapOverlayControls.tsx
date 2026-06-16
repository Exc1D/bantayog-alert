interface Props {
  activeOverlays: Set<string>
  onToggleOverlay: (overlayId: string) => void
  triagePanelOpen?: boolean
}

const PRIMARY_OPTIONS = [
  { id: 'all_incidents', label: 'All' },
  { id: 'active_only', label: 'Active Only' },
] as const

export function MapOverlayControls({ activeOverlays, onToggleOverlay, triagePanelOpen }: Props) {
  const currentFilter = activeOverlays.has('active_only') ? 'active_only' : 'all_incidents'

  const handleSegmentClick = (id: string) => {
    if (id === currentFilter) return
    // Toggle off current, toggle on new
    onToggleOverlay(currentFilter)
    onToggleOverlay(id)
  }

  return (
    <div
      className={`absolute top-4 z-[1000] rounded-lg border border-white/10 bg-[var(--color-surface-elevated)] p-3 shadow-xl ${triagePanelOpen ? 'right-[400px]' : 'right-4'}`}
    >
      <div className="flex items-center gap-2">
        {/* Segmented control: All | Active Only */}
        <div className="flex rounded-md border border-white/10 bg-[var(--color-surface)]">
          {PRIMARY_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => {
                handleSegmentClick(opt.id)
              }}
              aria-pressed={currentFilter === opt.id}
              className="px-3 py-2 text-xs font-medium transition-colors"
              style={{
                minHeight: '44px',
                minWidth: '44px',
                backgroundColor: currentFilter === opt.id ? 'var(--color-sienna)' : 'transparent',
                color: currentFilter === opt.id ? 'white' : 'var(--color-text-secondary)',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
