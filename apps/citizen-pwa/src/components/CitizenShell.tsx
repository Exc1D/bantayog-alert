import type { ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Map, Rss, AlertTriangle, Bell, User, WifiOff } from 'lucide-react'
import { useOfflineQueueCount } from '../hooks/useOfflineQueueCount.js'
import { useUIStore } from '../lib/store.js'
import '../styles/design-tokens.css'

const TAB_PATHS = ['/', '/feed', '/alerts', '/profile'] as const
type TabPath = (typeof TAB_PATHS)[number]

const TABS = [
  { label: 'Map', path: '/', Icon: Map, isCenter: false },
  { label: 'Feed', path: '/feed', Icon: Rss, isCenter: false },
  { label: 'Report', path: '/report', Icon: AlertTriangle, isCenter: true },
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
    <div className="min-h-[100dvh] bg-surface-100 relative">
      {/* Offline banner */}
      <AnimatePresence>
        {showOfflineBanner && (
          <motion.div
            initial={{ y: -40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -40, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="sticky top-0 z-toast bg-warning-400/10 border-b border-warning-400/30 px-4 py-2 flex items-center justify-center gap-2"
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

      {/* Page content with directional transitions */}
      <main className="pb-20">
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
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Bottom nav */}
      <nav
        aria-label="Main navigation"
        className="fixed bottom-0 left-0 right-0 z-nav bg-surface-50/90 backdrop-blur-md border-t border-surface-200"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <div className="flex items-center justify-around h-16 max-w-lg mx-auto relative">
          {TABS.map(({ path, label, Icon, isCenter }) => {
            const isActive = pathname === path

            if (isCenter) {
              return (
                <button
                  key={path}
                  type="button"
                  aria-label={label}
                  onClick={() => {
                    handleNav(path)
                  }}
                  className="-mt-6 flex items-center justify-center w-[72px] h-[72px] rounded-full bg-gradient-to-br from-brand-500 to-brand-600 shadow-glow-teal active:scale-95 transition-transform"
                >
                  <Icon size={28} strokeWidth={2.5} className="text-white" />
                </button>
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
