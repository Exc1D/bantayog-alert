import type { ReactNode } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '@bantayog/shared-ui'
import { useOwnDispatches } from '../hooks/useOwnDispatches'
import { SosHoldButton } from './SosHoldButton'
import styles from './Shell.module.css'

interface Props {
  children: ReactNode
}

export function Shell({ children }: Props) {
  const { user } = useAuth()
  const { groups } = useOwnDispatches(user?.uid)
  const location = useLocation()

  const pendingCount = groups.pending.length
  const activeDispatchId = groups.active[0]?.dispatchId ?? null

  const tabs = [
    { to: '/', label: 'Dispatches', icon: '📋', exact: true },
    { to: '/map', label: 'Map', icon: '🗺️', exact: false },
    { to: '/messages', label: 'Messages', icon: '💬', exact: false },
    { to: '/profile', label: 'Profile', icon: '👤', exact: false },
  ]

  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <span className={styles.headerTitle}>Bantayog Alert</span>
        <div className={styles.headerRight}>
          <SosHoldButton activeDispatchId={activeDispatchId} disabled={!activeDispatchId} />
        </div>
      </header>

      <main className={styles.content}>{children}</main>

      <nav className={styles.tabBar} aria-label="Main navigation">
        {tabs.map((tab) => {
          const isActive = tab.exact
            ? location.pathname === tab.to
            : location.pathname.startsWith(tab.to)
          return (
            <div key={tab.to} className={styles.tabItem}>
              <NavLink
                to={tab.to}
                className={[styles.tab, isActive && styles.tabActive].filter(Boolean).join(' ')}
                aria-label={tab.label}
                {...(isActive ? { 'aria-current': 'page' as const } : {})}
              >
                <span className={styles.tabIcon} aria-hidden="true">
                  {tab.icon}
                </span>
                <span>{tab.label}</span>
              </NavLink>
              {tab.to === '/' && pendingCount > 0 && (
                <span className={styles.badge} aria-label={`${String(pendingCount)} pending`}>
                  {pendingCount > 9 ? '9+' : pendingCount}
                </span>
              )}
            </div>
          )
        })}
      </nav>
    </div>
  )
}
