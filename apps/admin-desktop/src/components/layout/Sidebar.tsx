import { cn } from '@/lib/utils'
import { useUIStore } from '@/stores/uiStore'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  Map,
  Users,
  AlertTriangle,
  ArrowUpRight,
  FileText,
  ClipboardList,
  Activity,
  Settings,
  MessageSquare,
  Eraser,
  HandHelping,
} from 'lucide-react'

interface NavItem {
  label: string
  path: string
  icon: React.ReactNode
  shortcut: string
  badge?: number
}

const navItems: NavItem[] = [
  {
    label: 'Dashboard',
    path: '/dashboard',
    icon: <LayoutDashboard className="w-5 h-5" />,
    shortcut: 'D',
  },
  { label: 'Map', path: '/map', icon: <Map className="w-5 h-5" />, shortcut: 'M' },
  { label: 'Users', path: '/users', icon: <Users className="w-5 h-5" />, shortcut: 'U' },
  {
    label: 'Declare Alerts',
    path: '/emergency',
    icon: <AlertTriangle className="w-5 h-5" />,
    shortcut: 'A',
  },
  {
    label: 'NDRRMC Queue',
    path: '/ndrrmc',
    icon: <ArrowUpRight className="w-5 h-5" />,
    shortcut: 'N',
    badge: 2,
  },
  { label: 'Reports', path: '/reports', icon: <FileText className="w-5 h-5" />, shortcut: 'R' },
  {
    label: 'Audit Logs',
    path: '/audit',
    icon: <ClipboardList className="w-5 h-5" />,
    shortcut: 'L',
  },
  {
    label: 'System Health',
    path: '/health',
    icon: <Activity className="w-5 h-5" />,
    shortcut: 'H',
  },
  { label: 'SMS Audit', path: '/sms', icon: <MessageSquare className="w-5 h-5" />, shortcut: '' },
  {
    label: 'Shift Handoff',
    path: '/handoff',
    icon: <HandHelping className="w-5 h-5" />,
    shortcut: '',
  },
  { label: 'Data Erasure', path: '/erasure', icon: <Eraser className="w-5 h-5" />, shortcut: '' },
  { label: 'Settings', path: '/settings', icon: <Settings className="w-5 h-5" />, shortcut: 'S' },
]

export function Sidebar() {
  const navigate = useNavigate()
  const location = useLocation()
  const { sidebarCollapsed, toggleSidebar } = useUIStore()

  return (
    <aside
      className={cn(
        'fixed left-0 top-[56px] bottom-0 bg-white border-r border-border z-40 flex flex-col transition-all duration-200',
        sidebarCollapsed ? 'w-16' : 'w-[240px]',
      )}
    >
      <div className="flex-1 overflow-y-auto py-2">
        {navItems.map((item) => {
          const active = location.pathname === item.path
          return (
            <button
              key={item.path}
              onClick={() => {
                void navigate(item.path)
              }}
              className={cn(
                'w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors duration-150 relative',
                active
                  ? 'bg-muted text-accent border-l-[3px] border-accent'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground border-l-[3px] border-transparent',
              )}
            >
              <span className={cn('shrink-0', active ? 'text-accent' : 'text-muted-foreground')}>
                {item.icon}
              </span>
              {!sidebarCollapsed && (
                <>
                  <span className="flex-1 text-left">{item.label}</span>
                  {item.badge !== undefined && item.badge > 0 && (
                    <span className="px-1.5 py-0.5 bg-purple-100 text-purple-700 text-[10px] font-medium rounded">
                      {item.badge}
                    </span>
                  )}
                  {item.shortcut && (
                    <kbd className="px-1 py-0.5 bg-muted border border-border rounded text-[10px] font-mono text-muted-foreground">
                      {item.shortcut}
                    </kbd>
                  )}
                </>
              )}
            </button>
          )
        })}
      </div>

      <button
        onClick={toggleSidebar}
        className="w-full py-2 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors text-center border-t border-border"
      >
        {sidebarCollapsed ? '→' : '←'}
      </button>
    </aside>
  )
}
