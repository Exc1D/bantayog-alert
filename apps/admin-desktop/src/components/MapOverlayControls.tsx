import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { Tooltip } from './Tooltip'

interface Props {
  activeOverlays: Set<string>
  onToggleOverlay: (overlayId: string) => void
  triagePanelOpen?: boolean
}

const PRIMARY_OPTIONS = [
  { id: 'all_incidents', label: 'All' },
  { id: 'active_only', label: 'Active Only' },
] as const

const CHECKBOX_OPTIONS = [
  { id: 'heatmap', label: 'Heatmap', hint: 'Density visualization of incident locations' },
  {
    id: 'responder_locations',
    label: 'Responder Locations',
    hint: 'Live GPS positions of active responders',
  },
  {
    id: 'provincial_resources',
    label: 'Provincial Resources',
    hint: 'Hospitals, evacuation centers, and supply depots',
  },
  {
    id: 'municipal_labels',
    label: 'Municipal Labels',
    hint: 'Boundary lines and municipality names',
  },
] as const

export function MapOverlayControls({ activeOverlays, onToggleOverlay, triagePanelOpen }: Props) {
  const [showMore, setShowMore] = useState(false)

  const currentFilter = activeOverlays.has('active_only') ? 'active_only' : 'all_incidents'

  const handleSegmentClick = (id: string) => {
    if (id === currentFilter) return
    // Toggle off current, toggle on new
    onToggleOverlay(currentFilter)
    onToggleOverlay(id)
  }

  const primaryCheckboxes = CHECKBOX_OPTIONS.slice(0, 1)
  const secondaryCheckboxes = CHECKBOX_OPTIONS.slice(1)

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

        {/* Primary checkboxes */}
        {primaryCheckboxes.map((opt) => (
          <Tooltip key={opt.id} content={opt.hint}>
            <label
              className="flex cursor-pointer items-center gap-1.5 px-2 py-2 text-xs text-[var(--color-text-secondary)]"
              style={{ minHeight: '44px' }}
            >
              <input
                type="checkbox"
                checked={activeOverlays.has(opt.id)}
                onChange={() => {
                  onToggleOverlay(opt.id)
                }}
                aria-label={opt.label}
              />
              {opt.label}
            </label>
          </Tooltip>
        ))}

        {/* More toggle */}
        <button
          type="button"
          onClick={() => {
            setShowMore((s) => !s)
          }}
          className="flex items-center gap-1 px-2 py-2 text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
          style={{ minHeight: '44px', minWidth: '44px' }}
          aria-expanded={showMore}
        >
          More
          {showMore ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </button>
      </div>

      {/* Secondary checkboxes */}
      {showMore && (
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 border-t border-white/10 pt-2">
          {secondaryCheckboxes.map((opt) => (
            <Tooltip key={opt.id} content={opt.hint}>
              <label
                className="flex cursor-pointer items-center gap-1.5 py-1 text-xs text-[var(--color-text-secondary)]"
                style={{ minHeight: '44px' }}
              >
                <input
                  type="checkbox"
                  checked={activeOverlays.has(opt.id)}
                  onChange={() => {
                    onToggleOverlay(opt.id)
                  }}
                  aria-label={opt.label}
                />
                {opt.label}
              </label>
            </Tooltip>
          ))}
        </div>
      )}
    </div>
  )
}
