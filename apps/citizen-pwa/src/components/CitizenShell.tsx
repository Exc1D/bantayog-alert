import type { ReactNode } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Map, Rss, CirclePlus, Bell, User, WifiOff, FileText } from 'lucide-react'
import { useOfflineQueueCount } from '../hooks/useOfflineQueueCount.js'
import { ReportStatusPill } from './ReportStatusPill.js'
import { useAlertReadState } from '../hooks/useAlertReadState.js'
import { useAlerts } from '../hooks/useAlerts.js'
import { useUIStore } from '../lib/store.js'
import { useReducedMotion } from '../hooks/useReducedMotion.js'
import { wizardSnapshot } from '../services/wizard-snapshot.js'
import '../styles/design-tokens.css'

const TAB_PATHS = ['/', '/feed', '/report', '/alerts', '/profile'] as const
type TabPath = (typeof TAB_PATHS)[number]

const TABS = [
  { label: 'Map', path: '/', Icon: Map, isCenter: false },
  { label: 'Feed', path: '/feed', Icon: Rss, isCenter: false },
  { label: 'Report', path: '/report', Icon: CirclePlus, isCenter: true },
  { label: 'Alerts', path: '/alerts', Icon: Bell, isCenter: false },
  { label: 'Profile', path: '/profile', Icon: User, isCenter: false },
] as const

const PAGE_VARIANTS = {
  initial: (dir: 'forward' | 'backward') => ({ x: dir === 'forward' ? '10%' : '-10%', opacity: 0 }),
  animate: { x: 0, opacity: 1 },
  exit: (dir: 'forward' | 'backward') => ({ x: dir === 'forward' ? '-10%' : '10%', opacity: 0 }),
}

export function CitizenShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { isOnline, queueCount } = useOfflineQueueCount()
  const { alerts } = useAlerts()
  const { unreadCount } = useAlertReadState()
  const navDirection = useUIStore((s) => s.navDirection)
  const setNavDirection = useUIStore((s) => s.setNavDirection)
  const showOfflineBanner = !isOnline
  const prefersReducedMotion = useReducedMotion()
  const [hasDraft, setHasDraft] = useState(false)

  // Check for an in-progress wizard snapshot on mount. Hide the banner when
  // the user is already on the /report route (they're actively filling it).
  useEffect(() => {
    if (pathname.startsWith('/report')) return
    void wizardSnapshot
      .load()
      .then((snap) => {
        setHasDraft(snap !== null)
      })
      .catch((err: unknown) => {
        console.warn('[CitizenShell] Failed to load wizard snapshot:', err)
        // Non-fatal — draft resume is convenience, not required
      })
  }, [pathname])

  // Calculate unread alerts count
  const alertIds = useMemo(() => alerts.map((a) => a.id), [alerts])
  const unreadAlerts = unreadCount(alertIds)

  const handleNav = (path: string) => {
    const currentIndex = TAB_PATHS.indexOf(pathname as TabPath)
    const nextIndex = TAB_PATHS.indexOf(path as TabPath)
    setNavDirection(nextIndex >= currentIndex ? 'forward' : 'backward')
    void navigate(path)
  }

  const handleDiscardDraft = () => {
    void wizardSnapshot
      .clear()
      .then(() => {
        setHasDraft(false)
      })
      .catch((err: unknown) => {
        console.warn('[CitizenShell] Failed to discard draft:', err)
        // Keep banner visible so user understands issue
      })
  }

  const handleResumeDraft = () => {
    setNavDirection('forward')
    setHasDraft(false)
    void navigate('/report')
  }

  const showDraftBanner = hasDraft && !pathname.startsWith('/report')

  return (
    <>
      {/* Skip to main content link - visible on focus */}
      <a
        href="#main-content"
        className="sr-only focus-visible:not-sr-only focus-visible:absolute focus-visible:top-4 focus-visible:left-4 focus-visible:z-[9999] focus-visible:px-4 focus-visible:py-2 focus-visible:rounded-lg focus-visible:font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-surface-900 focus-visible:ring-2 focus-visible:ring-white"
      >
        Skip to main content
      </a>

      {/* h-[100dvh] flex-col gives every child a definite height so absolute
        descendants (MapTab, motion.div) can resolve inset-0 correctly.
        overflow-x-hidden clips the horizontal page-transition slide. */}
      <div className="h-[100dvh] flex flex-col overflow-x-hidden bg-surface-100">
        {/* Offline banner — shrinks the flex-1 main area when visible */}
        <AnimatePresence>
          {showOfflineBanner && (
            <motion.div
              initial={prefersReducedMotion ? false : { y: -40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={prefersReducedMotion ? { y: 0, opacity: 0 } : { y: -40, opacity: 0 }}
              transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.3 }}
              className="shrink-0 z-toast bg-warning-400/10 border-b border-warning-400/30 px-4 py-2 flex items-center justify-center gap-2"
              role="status"
              aria-live="polite"
              aria-atomic="true"
            >
              <WifiOff size={16} className="text-warning-500" />
              <span className="text-sm font-medium text-warning-500">
                {queueCount > 0
                  ? `Offline — ${String(queueCount)} report${queueCount !== 1 ? 's' : ''} queued`
                  : "You're offline. Reports saved on device."}
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Draft resume banner — shows when an in-progress wizard snapshot exists
          and the user is not already on /report. */}
        <AnimatePresence>
          {showDraftBanner && (
            <motion.div
              initial={prefersReducedMotion ? false : { y: -40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={prefersReducedMotion ? { y: 0, opacity: 0 } : { y: -40, opacity: 0 }}
              transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.3 }}
              className="shrink-0 z-toast bg-brand-50 border-b border-brand-200 px-4 py-2 flex items-center gap-2"
              role="status"
              aria-label="Draft report available"
              aria-live="polite"
              aria-atomic="true"
            >
              <FileText size={16} className="text-brand-600 shrink-0" aria-hidden="true" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-surface-900 m-0">Resume unfinished report</p>
                <p className="text-xs text-surface-600 italic m-0">Hindi pa natapos ang ulat</p>
              </div>
              <button
                type="button"
                onClick={handleResumeDraft}
                className="text-xs font-semibold text-white bg-brand-600 px-3 py-1.5 rounded-md min-h-[36px]"
              >
                Resume
              </button>
              <button
                type="button"
                onClick={handleDiscardDraft}
                className="text-xs font-medium text-surface-600 px-2 py-1.5 rounded-md min-h-[36px]"
                aria-label="Discard draft"
              >
                Discard
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Page content — flex-1 min-h-0 gives a definite height; relative makes
          it the containing block for the absolute motion.div inside */}
        <main id="main-content" className="flex-1 relative min-h-0">
          <AnimatePresence mode="wait" custom={navDirection}>
            <motion.div
              key={pathname}
              custom={navDirection}
              {...(prefersReducedMotion
                ? {}
                : {
                    variants: PAGE_VARIANTS,
                    initial: 'initial' as const,
                    exit: 'exit' as const,
                  })}
              animate={prefersReducedMotion ? { opacity: 1 } : 'animate'}
              transition={
                prefersReducedMotion
                  ? { duration: 0 }
                  : {
                      duration: 0.3,
                      ease: [0.4, 0, 0.2, 1] as [number, number, number, number],
                    }
              }
              className="absolute inset-0"
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>

        <ReportStatusPill />

        {/* Bottom nav — in flex flow so its height is subtracted from main.
          The FAB's -mt-6 intentionally overlaps into main; that's fine since
          main has no overflow:hidden. */}
        <nav
          aria-label="Main navigation"
          className="shrink-0 z-nav bg-surface-50/90 backdrop-blur-md border-t border-surface-200"
          style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
        >
          <div className="flex items-center justify-around h-16 max-w-lg mx-auto relative">
            {TABS.map(({ path, label, Icon, isCenter }) => {
              const isActive = pathname === path

              if (isCenter) {
                return (
                  <div key={path} className="relative h-16 w-16 flex items-center justify-center">
                    <button
                      type="button"
                      aria-label={label}
                      onClick={() => {
                        handleNav(path)
                      }}
                      className="absolute -top-8 flex items-center justify-center w-[64px] h-[64px] rounded-full bg-brand-600 shadow-lg active:scale-95 transition-transform focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-brand-600"
                    >
                      <Icon size={30} strokeWidth={1.5} className="text-white" />
                    </button>
                    <span className="absolute bottom-[14px] text-[10px] font-medium leading-none text-surface-600">
                      {label}
                    </span>
                  </div>
                )
              }

              return (
                <button
                  key={path}
                  type="button"
                  onClick={() => {
                    handleNav(path)
                  }}
                  {...(isActive ? { 'aria-current': 'page' as const } : {})}
                  className="relative flex flex-col items-center justify-center w-16 h-16 gap-1 min-w-[44px] min-h-[44px] border-none bg-transparent cursor-pointer"
                >
                  <motion.div
                    animate={isActive ? { scale: prefersReducedMotion ? 1 : 1.1 } : { scale: 1 }}
                    transition={{ duration: prefersReducedMotion ? 0 : 0.15 }}
                  >
                    <Icon
                      size={22}
                      strokeWidth={isActive ? 2.5 : 1.5}
                      className={isActive ? 'text-brand-500' : 'text-surface-600'}
                    />
                  </motion.div>
                  <span
                    className={`text-[10px] font-medium leading-none ${isActive ? 'text-brand-500' : 'text-surface-600'}`}
                  >
                    {label}
                  </span>
                  {unreadAlerts > 0 && label === 'Alerts' && (
                    <span
                      className="absolute top-1 right-2 w-5 h-5 bg-error-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center"
                      aria-hidden="true"
                    >
                      {unreadAlerts > 9 ? '9+' : String(unreadAlerts)}
                    </span>
                  )}
                  {isActive && (
                    <motion.div
                      layoutId="navbar-indicator"
                      className="absolute top-0 w-8 h-0.5 bg-brand-500 rounded-full"
                      transition={
                        prefersReducedMotion
                          ? { duration: 0 }
                          : { type: 'spring', stiffness: 500, damping: 30 }
                      }
                    />
                  )}
                </button>
              )
            })}
          </div>
        </nav>
      </div>
    </>
  )
}
