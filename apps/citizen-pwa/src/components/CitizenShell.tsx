import type { ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Map, Rss, CirclePlus, Bell, User, WifiOff } from 'lucide-react'
import { useOfflineQueueCount } from '../hooks/useOfflineQueueCount.js'
import { useUIStore } from '../lib/store.js'
import '../styles/design-tokens.css'

const TAB_PATHS = ['/', '/feed', '/alerts', '/profile'] as const
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
  const navDirection = useUIStore((s) => s.navDirection)
  const setNavDirection = useUIStore((s) => s.setNavDirection)
  const showOfflineBanner = !isOnline

  const handleNav = (path: string) => {
    const currentIndex = TAB_PATHS.indexOf(pathname as TabPath)
    const nextIndex = TAB_PATHS.indexOf(path as TabPath)
    setNavDirection(nextIndex >= currentIndex ? 'forward' : 'backward')
    void navigate(path)
  }

  return (
    // h-[100dvh] flex-col gives every child a definite height so absolute
    // descendants (MapTab, motion.div) can resolve inset-0 correctly.
    // overflow-x-hidden clips the horizontal page-transition slide.
    <div className="h-[100dvh] flex flex-col overflow-x-hidden bg-surface-100">
      {/* Offline banner — shrinks the flex-1 main area when visible */}
      <AnimatePresence>
        {showOfflineBanner && (
          <motion.div
            initial={{ y: -40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -40, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="shrink-0 z-toast bg-warning-400/10 border-b border-warning-400/30 px-4 py-2 flex items-center justify-center gap-2"
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

      {/* Page content — flex-1 min-h-0 gives a definite height; relative makes
          it the containing block for the absolute motion.div inside */}
      <main className="flex-1 relative min-h-0">
        <AnimatePresence mode="wait" custom={navDirection}>
          <motion.div
            key={pathname}
            custom={navDirection}
            variants={PAGE_VARIANTS}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{
              duration: 0.3,
              ease: [0.4, 0, 0.2, 1] as [number, number, number, number],
            }}
            className="absolute inset-0"
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>

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
                    className="absolute -top-10 flex items-center justify-center w-[64px] h-[64px] rounded-full bg-brand-600 shadow-lg active:scale-95 transition-transform"
                  >
                    <Icon size={30} strokeWidth={1.5} className="text-white" />
                  </button>
                  <span className="absolute bottom-[14px] text-[10px] font-medium leading-none text-surface-300">
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
                aria-current={isActive ? 'page' : undefined}
                className="relative flex flex-col items-center justify-center w-16 h-16 gap-1 min-w-[44px] min-h-[44px] border-none bg-transparent cursor-pointer"
              >
                <motion.div
                  animate={isActive ? { scale: 1.1 } : { scale: 1 }}
                  transition={{ duration: 0.15 }}
                >
                  <Icon
                    size={22}
                    strokeWidth={isActive ? 2.5 : 1.5}
                    className={isActive ? 'text-brand-500' : 'text-surface-300'}
                  />
                </motion.div>
                <span
                  className={`text-[10px] font-medium leading-none ${isActive ? 'text-brand-500' : 'text-surface-300'}`}
                >
                  {label}
                </span>
                {isActive && (
                  <motion.div
                    layoutId="navbar-indicator"
                    className="absolute top-0 w-8 h-0.5 bg-brand-500 rounded-full"
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  />
                )}
              </button>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
