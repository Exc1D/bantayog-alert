import type { ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Map, Rss, AlertTriangle, Bell, User } from 'lucide-react'
import '../styles/design-tokens.css'

const TABS = [
  { label: 'Map', path: '/', Icon: Map },
  { label: 'Feed', path: '/feed', Icon: Rss },
  { label: 'Report', path: '/report', Icon: AlertTriangle },
  { label: 'Alerts', path: '/alerts', Icon: Bell },
  { label: 'Profile', path: '/profile', Icon: User },
] as const

export function CitizenShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  const { pathname } = useLocation()

  return (
    <div style={{ minHeight: '100dvh', overflow: 'hidden', background: 'var(--color-surface)' }}>
      <header
        role="banner"
        style={{
          position: 'fixed',
          inset: '0 0 auto',
          zIndex: 50,
          display: 'flex',
          alignItems: 'center',
          height: 64,
          padding: '0 16px',
          background: 'var(--color-primary)',
          color: '#fff',
          fontFamily: "'Plus Jakarta Sans', sans-serif",
          fontSize: '1rem',
          fontWeight: 800,
          letterSpacing: '0.08em',
        }}
      >
        VIGILANT
      </header>
      <main style={{ minHeight: '100dvh', paddingTop: 64, paddingBottom: 88 }}>{children}</main>
      <nav
        aria-label="Main navigation"
        style={{
          position: 'fixed',
          inset: 'auto 0 0',
          zIndex: 45,
          display: 'flex',
          justifyContent: 'space-around',
          alignItems: 'center',
          height: 88,
          paddingBottom: 'env(safe-area-inset-bottom)',
          background: 'rgba(255,255,255,0.85)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
        }}
      >
        {TABS.map((tab) => (
          <button
            key={tab.path}
            type="button"
            onClick={() => {
              void navigate(tab.path)
            }}
            aria-current={pathname === tab.path ? 'page' : undefined}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 4,
              border: 'none',
              background: 'none',
              color:
                pathname === tab.path ? 'var(--color-primary)' : 'var(--color-on-surface-variant)',
              fontFamily: "'Inter', sans-serif",
              fontSize: '0.625rem',
              fontWeight: pathname === tab.path ? 600 : 400,
              minWidth: 44,
              minHeight: 44,
              padding: '8px 12px',
              borderRadius: 8,
              cursor: 'pointer',
            }}
          >
            <tab.Icon
              size={20}
              strokeWidth={pathname === tab.path ? 2.5 : 2}
              color={
                pathname === tab.path ? 'var(--color-primary)' : 'var(--color-on-surface-variant)'
              }
            />
            {tab.label}
          </button>
        ))}
      </nav>
    </div>
  )
}
