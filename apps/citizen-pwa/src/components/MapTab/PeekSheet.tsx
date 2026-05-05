import { useRef, type TouchEvent } from 'react'
import { MapPin } from 'lucide-react'
import { getSeverityStyle } from '../../utils/useSeverityStyle.js'

interface SelectedPin {
  id: string
  type: 'incident' | 'myReport'
  label: string
  severity?: 'high' | 'medium' | 'low'
}

interface Props {
  sheetPhase: 'hidden' | 'peek' | 'expanded'
  pin: SelectedPin | null
  onExpand: () => void
  onDismiss: () => void
}

const SWIPE_THRESHOLD = 50

export function PeekSheet({ sheetPhase, pin, onExpand, onDismiss }: Props) {
  const startY = useRef<number | null>(null)
  if (sheetPhase !== 'peek' || !pin) return null

  const parts = pin.label.split(' · ')
  const primaryText = parts[0] ?? pin.label
  const secondaryText = parts.slice(1).join(' · ')
  const dotColor = pin.severity ? getSeverityStyle(pin.severity).dotHex : undefined

  function handleTouchStart(event: TouchEvent<HTMLDivElement>) {
    startY.current = event.touches[0]?.clientY ?? null
  }

  function handleTouchEnd(event: TouchEvent<HTMLDivElement>) {
    if (startY.current === null) return
    const endY = event.changedTouches[0]?.clientY
    if (typeof endY !== 'number') {
      startY.current = null
      return
    }
    const delta = endY - startY.current
    startY.current = null
    if (delta > SWIPE_THRESHOLD) onDismiss()
    if (delta < -SWIPE_THRESHOLD) onExpand()
  }

  /* eslint-disable jsx-a11y/no-noninteractive-element-interactions */
  return (
    <div
      role="dialog"
      aria-modal="false"
      tabIndex={-1}
      data-testid="peek-sheet"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onDismiss()
        if (e.key === 'Enter') onExpand()
      }}
      className="absolute bottom-4 left-3 right-3 z-[1001] bg-white rounded-2xl shadow-lg overflow-hidden"
    >
      <div className="w-8 h-1 rounded-full bg-surface-200 mx-auto mt-2 mb-1" />
      <div className="px-4 pb-3">
        <div className="flex items-center gap-2">
          {dotColor ? (
            <span
              aria-hidden="true"
              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: dotColor }}
            />
          ) : null}
          <div className="flex-1 min-w-0">
            <p className="text-base font-bold text-surface-900 truncate">{primaryText}</p>
            {secondaryText ? (
              <p className="text-sm text-surface-500 truncate flex items-center gap-1 mt-0.5">
                <MapPin className="w-3.5 h-3.5" />
                {secondaryText}
              </p>
            ) : null}
          </div>
        </div>
        <div className="flex gap-3 pt-3 border-t border-surface-100 mt-3">
          <button
            type="button"
            aria-label="Track incident"
            onClick={onExpand}
            className="text-brand-500 text-sm font-medium"
          >
            Track
          </button>
        </div>
      </div>
    </div>
  )
  /* eslint-enable jsx-a11y/no-noninteractive-element-interactions */
}
