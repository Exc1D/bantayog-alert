import { Link, useLocation, Outlet } from 'react-router-dom'
import { MapPin, List, AlertCircle, Bell, User } from 'lucide-react'
import { useReportQueue } from '@/features/report/hooks/useReportQueue'

const navItems = [
  { path: '/map', label: 'Map', icon: MapPin },
  { path: '/feed', label: 'Feed', icon: List },
  { path: '/report', label: 'Report', icon: AlertCircle, prominent: true },
  { path: '/alerts', label: 'Alerts', icon: Bell },
  { path: '/profile', label: 'Profile', icon: User },
]

export function Navigation() {
  const location = useLocation()
  const { queueSize } = useReportQueue()

  return (
    <>
      <Outlet />
      <nav
        data-testid="navigation"
        className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 safe-area-bottom"
      >
        <div className="flex justify-around items-center h-16 max-w-md mx-auto">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path
            const Icon = item.icon

            if (item.prominent) {
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className="relative -top-6 flex items-center justify-center w-16 h-16 rounded-2xl bg-primary-red border-2 border-white shadow-lg"
                  aria-label={`Report ${item.label}`}
                >
                  <div className="flex flex-col items-center justify-center">
                    <Icon size={28} className="text-white" />
                    <span className="text-[10px] font-bold mt-0.5 text-white uppercase tracking-wide">
                      {item.label}
                    </span>
                  </div>
                  {queueSize > 0 && (
                    <span
                      data-testid="queue-badge"
                      className="absolute -top-1 -right-1 w-5 h-5 bg-yellow-400 text-red-900 text-xs font-bold rounded-full flex items-center justify-center animate-pulse border-2 border-white"
                      aria-label={`${queueSize} reports waiting to sync`}
                    >
                      {queueSize > 9 ? '9+' : queueSize}
                    </span>
                  )}
                </Link>
              )
            }

            return (
              <Link
                key={item.path}
                to={item.path}
                aria-current={isActive ? 'page' : undefined}
                className={`flex flex-col items-center justify-center w-16 h-full ${
                  isActive ? 'text-primary-blue' : 'text-gray-500'
                }`}
              >
                <Icon size={24} />
                <span className="text-xs mt-1">{item.label}</span>
              </Link>
            )
          })}
        </div>
      </nav>
    </>
  )
}
