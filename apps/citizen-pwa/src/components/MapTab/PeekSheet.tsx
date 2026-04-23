import { useRef, type TouchEvent } from 'react'

interface SelectedPin {
  id: string
  type: 'incident' | 'myReport'
  label: string
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
        height: 80,
        padding: '8px 16px 0',
        background: 'rgba(255,255,255,0.95)',
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
          background: 'var(--color-on-surface-variant)',
          opacity: 0.35,
        }}
      />
      <p
        style={{
          width: '100%',
          margin: '8px 0 0',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          fontFamily: "'Inter', sans-serif",
          fontSize: '0.875rem',
          fontWeight: 500,
          color: 'var(--color-primary)',
        }}
      >
        {pin.label}
      </p>
      <button
        type="button"
        aria-label="Pull up for full detail"
        onClick={onExpand}
        style={{
          alignSelf: 'flex-start',
          border: 'none',
          background: 'none',
          padding: '2px 0 0',
          color: 'var(--color-on-surface-variant)',
          fontFamily: "'Inter', sans-serif",
          fontSize: '0.75rem',
          cursor: 'pointer',
        }}
      >
        ↑ Pull up for full detail
      </button>
    </div>
  )
}
