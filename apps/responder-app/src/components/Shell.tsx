import type { ReactNode } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { ClipboardList, Map, User } from 'lucide-react'
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
    {
      to: '/',
      label: 'Dispatches',
      icon: <ClipboardList size={20} aria-hidden="true" />,
      exact: true,
    },
    { to: '/map', label: 'Map', icon: <Map size={20} aria-hidden="true" />, exact: false },
    { to: '/profile', label: 'Profile', icon: <User size={20} aria-hidden="true" />, exact: false },
  ]

  const isActive = (tab: (typeof tabs)[number]) => {
    if (tab.to === '/') {
      return location.pathname === '/' || location.pathname.startsWith('/dispatches')
    }
    return tab.exact ? location.pathname === tab.to : location.pathname.startsWith(tab.to)
  }

  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <span className={styles.headerTitle}>BANTAYOG ALERT</span>
        <div className={styles.headerRight}>
          <span className={styles.onlineStatus} role="status" aria-label="Online">
            <span className={styles.onlineDot} aria-hidden="true" />
            Online
          </span>
          <SosHoldButton activeDispatchId={activeDispatchId} disabled={!activeDispatchId} />
        </div>
      </header>

      <main className={styles.content}>{children}</main>

      <nav className={styles.tabBar} aria-label="Main navigation">
        {tabs.map((tab) => {
          const active = isActive(tab)
          return (
            <div key={tab.to} className={styles.tabItem}>
              <NavLink
                to={tab.to}
                className={[styles.tab, active && styles.tabActive].filter(Boolean).join(' ')}
                aria-label={tab.label}
                {...(active ? { 'aria-current': 'page' as const } : {})}
              >
                <span className={styles.tabIcon}>{tab.icon}</span>
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
