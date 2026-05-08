import type { ReactNode } from 'react'
import { useFocusMode } from '../hooks/useFocusMode'

interface CommandCenterShellProps {
  topBanner: ReactNode
  mapZone: ReactNode
  gridZone: ReactNode
  bottomStrip: ReactNode
}

export function CommandCenterShell({
  topBanner,
  mapZone,
  gridZone,
  bottomStrip,
}: CommandCenterShellProps) {
  const { focusedZone, isFocusModeActive, exitFocusMode } = useFocusMode()

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        overflow: 'hidden',
      }}
    >
      <header style={{ flexShrink: 0 }}>{topBanner}</header>

      <main
        role="main"
        style={{
          display: 'flex',
          flex: 1,
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        <div
          style={{
            flex: focusedZone === 'map' ? 1 : 0.58,
            display: focusedZone === 'grid' ? 'none' : 'block',
            overflow: 'hidden',
            transition: 'flex 200ms cubic-bezier(0.25, 0.1, 0.25, 1)',
          }}
        >
          {mapZone}
        </div>

        <div
          style={{
            flex: focusedZone === 'grid' ? 1 : 0.42,
            display: focusedZone === 'map' ? 'none' : 'block',
            overflow: 'hidden',
            transition: 'flex 200ms cubic-bezier(0.25, 0.1, 0.25, 1)',
          }}
        >
          {gridZone}
        </div>

        {isFocusModeActive && (
          <button
            data-testid="exit-focus-button"
            onClick={exitFocusMode}
            style={{
              position: 'absolute',
              top: '16px',
              right: '16px',
              zIndex: 100,
              padding: '12px 24px',
              fontSize: '16px',
              fontWeight: 600,
              color: '#ffffff',
              backgroundColor: '#495057',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
            }}
          >
            Exit Focus
          </button>
        )}
      </main>

      <footer style={{ flexShrink: 0 }}>{bottomStrip}</footer>
    </div>
  )
}
