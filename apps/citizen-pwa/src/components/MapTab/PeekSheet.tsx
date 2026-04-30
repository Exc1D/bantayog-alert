import { useRef, type TouchEvent } from 'react'

const SEVERITY_COLORS: Record<string, string> = {
  high: '#dc2626',
  medium: '#a73400',
  low: '#001e40',
}

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
  const dotColor = pin.severity ? SEVERITY_COLORS[pin.severity] : undefined

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

  return (
    <div
      data-testid="peek-sheet"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      style={{
        position: 'fixed',
        inset: 'auto 0 88px',
        zIndex: 55,
        padding: '8px 16px 12px',
        background: 'rgba(255,255,255,0.97)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        boxShadow: '0 -2px 16px rgba(0,30,64,0.1)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}
    >
      <div
        style={{
          width: 32,
          height: 4,
          borderRadius: 9999,
          background: '#d1d5db',
          marginBottom: 10,
        }}
      />
      <div style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8 }}>
        {dotColor ? (
          <span
            aria-hidden="true"
            style={{
              width: 10,
              height: 10,
              borderRadius: '50%',
              background: dotColor,
              flexShrink: 0,
            }}
          />
        ) : null}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p
            style={{
              margin: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              fontSize: '0.9375rem',
              fontWeight: 700,
              color: '#001e40',
            }}
          >
            {primaryText}
          </p>
          {secondaryText ? (
            <p
              style={{
                margin: '2px 0 0',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                fontSize: '0.75rem',
                color: '#52606d',
              }}
            >
              {secondaryText}
            </p>
          ) : null}
        </div>
        <button
          type="button"
          aria-label="Pull up for full detail"
          onClick={onExpand}
          style={{
            border: 'none',
            background: '#001e40',
            color: '#fff',
            padding: '6px 12px',
            borderRadius: 999,
            fontSize: '0.75rem',
            fontWeight: 700,
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          Details ↑
        </button>
      </div>
    </div>
  )
}
