import {
  AlertTriangle,
  Bell,
  ChevronLeft,
  ChevronRight,
  HelpCircle,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Map,
  Newspaper,
  Phone,
  Radio,
  User,
  Volume2,
  VolumeX,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '@bantayog/shared-ui'
import { useNewReportSignal } from '../hooks/useNewReportSignal'
import { DeclareAlertModal } from './DeclareAlertModal'
import { EditHotlineModal } from './EditHotlineModal'
import { SuccessBanner } from './SuccessBanner'
import { ActionErrorBanner } from './ActionErrorBanner'
import { HelpModal } from './HelpModal'
import { canEditHotlines } from './hotline-form'

const SIDEBAR_COLLAPSED_KEY = 'bantayog:admin-sidebar-collapsed'
const SIDEBAR_WIDTH = {
  expanded: 'w-[248px]',
  collapsed: 'w-16',
}
const UTILITY_HEADER_HEIGHT = 'h-14'

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', Icon: LayoutDashboard },
  { href: '/triage', label: 'Triage', Icon: ListChecks, countKey: 'triage' },
  { href: '/map', label: 'Map', Icon: Map },
  { href: '/feed', label: 'Feed', Icon: Newspaper },
  { href: '/dispatches', label: 'Dispatches', Icon: Radio },
] as const

function readCollapsedPreference(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true'
  } catch {
    return false
  }
}

export function AdminShell() {
  const navigate = useNavigate()
  const { claims, signOut } = useAuth()
  const signal = useNewReportSignal()
  const [collapsed, setCollapsed] = useState(readCollapsedPreference)
  const [alertOpen, setAlertOpen] = useState(false)
  const [hotlineOpen, setHotlineOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const accountMenuRef = useRef<HTMLDetailsElement>(null)
  const showHotlines = canEditHotlines(claims)
  const role = claims?.role
  const canDeclareAlert =
    role === 'provincial_superadmin' || role === 'pdrrmo' || role === 'municipal_admin'

  const toggleCollapsed = () => {
    setCollapsed((current) => {
      const next = !current
      try {
        window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(next))
      } catch {
        // Storage is optional; the visible toggle still works for this session.
      }
      return next
    })
  }

  const closeAccountMenu = () => {
    if (accountMenuRef.current) {
      accountMenuRef.current.open = false
    }
  }

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (accountMenuRef.current && !accountMenuRef.current.contains(event.target as Node)) {
        closeAccountMenu()
      }
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && accountMenuRef.current?.open) {
        closeAccountMenu()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [])

  return (
    <div className="flex h-dvh overflow-hidden bg-[var(--color-surface)] text-[var(--color-text-primary)]">
      <aside
        data-testid="admin-sidebar"
        className={`${collapsed ? SIDEBAR_WIDTH.collapsed : SIDEBAR_WIDTH.expanded} flex shrink-0 flex-col border-r border-white/10 bg-[var(--color-surface-elevated)] transition-[width] duration-200`}
      >
        <div className={`${UTILITY_HEADER_HEIGHT} flex items-center justify-between px-3`}>
          {!collapsed && <span className="text-sm font-semibold">Bantayog Admin</span>}
          <button
            type="button"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            onClick={toggleCollapsed}
            className="rounded-md p-2 text-[var(--color-text-secondary)] hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>
        <nav aria-label="Admin navigation" className="flex-1 space-y-1 px-2 py-3">
          {NAV_ITEMS.map((item) => {
            const count = 'countKey' in item ? signal.triageDecisionCount : 0
            return (
              <NavLink
                key={item.href}
                to={item.href}
                data-tour={item.href.slice(1)}
                className={({ isActive }) =>
                  [
                    'flex min-h-10 items-center gap-3 rounded-md px-3 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50',
                    isActive
                      ? 'bg-white/10 text-[var(--color-text-primary)]'
                      : 'text-[var(--color-text-secondary)] hover:bg-white/5',
                  ].join(' ')
                }
              >
                <item.Icon className="h-4 w-4 shrink-0" />
                <span className={collapsed ? 'sr-only' : ''}>{item.label}</span>
                {count > 0 && (
                  <span className="ml-auto rounded-full bg-[var(--color-warning)] px-2 py-0.5 text-[11px] font-semibold text-white">
                    {count}
                  </span>
                )}
              </NavLink>
            )
          })}
        </nav>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header
          className={`${UTILITY_HEADER_HEIGHT} flex shrink-0 items-center justify-between border-b border-white/10 bg-[var(--color-surface)] px-4`}
        >
          <span className="text-sm font-semibold text-[var(--color-text-secondary)]">
            PDRRMO Camarines Norte
          </span>
          <div className="flex items-center gap-2">
            {canDeclareAlert && (
              <button
                type="button"
                onClick={() => {
                  setAlertOpen(true)
                }}
                className="flex items-center gap-2 rounded-md bg-[var(--color-danger)] px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-danger)]"
              >
                <AlertTriangle className="h-4 w-4" />
                Declare Alert
              </button>
            )}
            <button
              type="button"
              onClick={signal.toggleAudio}
              aria-label={signal.audioEnabled ? 'Mute audio alerts' : 'Enable audio alerts'}
              className="rounded-md p-2 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
            >
              {signal.audioEnabled ? (
                <Volume2 className="h-4 w-4 text-[var(--color-success)]" />
              ) : (
                <VolumeX className="h-4 w-4 text-[var(--color-text-muted)]" />
              )}
            </button>
            <button
              type="button"
              onClick={() => {
                void navigate('/triage')
              }}
              className="relative rounded-md p-2 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
              aria-label={`${String(signal.notificationCount)} notifications`}
            >
              <Bell className="h-5 w-5 text-[var(--color-text-secondary)]" />
              {signal.notificationCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--color-warning)] text-[10px] text-white">
                  {signal.notificationCount}
                </span>
              )}
            </button>
            <details ref={accountMenuRef} className="relative">
              <summary
                aria-label="Account menu"
                className="list-none rounded-md p-2 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
              >
                <User className="h-4 w-4 text-[var(--color-text-secondary)]" />
              </summary>
              <div className="absolute right-0 top-11 z-50 w-48 rounded-md border border-white/10 bg-[var(--color-surface-elevated)] p-1 text-sm shadow-xl">
                {showHotlines && (
                  <button
                    type="button"
                    onClick={() => {
                      setHotlineOpen(true)
                      closeAccountMenu()
                    }}
                    className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-[var(--color-text-secondary)] hover:bg-white/10"
                  >
                    <Phone className="h-4 w-4" />
                    Hotlines
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setHelpOpen(true)
                    closeAccountMenu()
                  }}
                  className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-[var(--color-text-secondary)] hover:bg-white/10"
                >
                  <HelpCircle className="h-4 w-4" />
                  Shortcuts
                </button>
                <button
                  type="button"
                  onClick={() => {
                    closeAccountMenu()
                    void signOut().catch((err: unknown) => {
                      setActionError(err instanceof Error ? err.message : 'Sign out failed')
                    })
                  }}
                  className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-[var(--color-text-secondary)] hover:bg-white/10"
                >
                  <LogOut className="h-4 w-4" />
                  Sign out
                </button>
              </div>
            </details>
          </div>
        </header>
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {successMessage && (
            <SuccessBanner
              message={successMessage}
              onDismiss={() => {
                setSuccessMessage(null)
              }}
            />
          )}
          {actionError && (
            <ActionErrorBanner
              message={actionError}
              onDismiss={() => {
                setActionError(null)
              }}
            />
          )}
          <Outlet />
        </div>
      </div>
      <DeclareAlertModal
        open={alertOpen}
        onClose={() => {
          setAlertOpen(false)
        }}
        onSuccess={() => {
          setAlertOpen(false)
          setSuccessMessage('Alert declared successfully')
        }}
        onError={(msg) => {
          setActionError(msg)
        }}
      />
      {showHotlines && (
        <EditHotlineModal
          open={hotlineOpen}
          onClose={() => {
            setHotlineOpen(false)
          }}
        />
      )}
      <HelpModal
        open={helpOpen}
        onClose={() => {
          setHelpOpen(false)
        }}
        shortcuts={[
          { key: 'Sidebar', description: 'Use navigation links to switch work areas' },
          { key: '?', description: 'Show page-specific shortcuts where available' },
          { key: 'Esc', description: 'Close open dialogs' },
        ]}
      />
    </div>
  )
}
