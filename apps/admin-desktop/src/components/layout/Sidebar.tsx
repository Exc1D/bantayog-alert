import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  Activity,
  AlertTriangle,
  ArrowRightLeft,
  ArrowUpRight,
  ClipboardList,
  Eraser,
  FileText,
  Inbox,
  LayoutDashboard,
  Map,
  MessageSquare,
  Settings,
  Users,
} from 'lucide-react'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { useAuth } from '@bantayog/shared-ui'
import { ACTIVE_REPORT_STATUSES } from '@bantayog/shared-types'
import { db } from '@/app/firebase'
import { cn } from '@/lib/utils'
import { useUIStore } from '@/stores/uiStore'

interface NavItem {
  label: string
  path: string
  icon: React.ReactNode
  shortcut?: string
  badge?: number
  superadminOnly?: boolean
}

interface NavGroup {
  label: string
  items: NavItem[]
}

// Live count of reports currently in the triage queue for this municipality.
// Mirrors the same query used by useMuniReports so the badge matches the page.
function useTriageCount(municipalityId: string | undefined): number {
  const [count, setCount] = useState(0)
  useEffect(() => {
    if (!municipalityId) return
    const q = query(
      collection(db, 'report_ops'),
      where('municipalityId', '==', municipalityId),
      where('status', 'in', ACTIVE_REPORT_STATUSES),
    )
    return onSnapshot(q, (snap) => {
      setCount(snap.size)
    })
  }, [municipalityId])
  return count
}

export function Sidebar() {
  const navigate = useNavigate()
  const location = useLocation()
  const { sidebarCollapsed, toggleSidebar } = useUIStore()
  const { claims } = useAuth()

  const role = typeof claims?.role === 'string' ? claims.role : ''
  const municipalityId =
    typeof claims?.municipalityId === 'string' ? claims.municipalityId : undefined
  const isSuperadmin = role === 'provincial_superadmin'

  const triageCount = useTriageCount(municipalityId)

  const groups: NavGroup[] = [
    {
      label: 'Operations',
      items: [
        {
          label: 'Triage Queue',
          path: '/',
          icon: <Inbox className="w-[18px] h-[18px]" />,
          shortcut: 'Q',
          badge: triageCount,
        },
        {
          label: 'Live Map',
          path: '/map',
          icon: <Map className="w-[18px] h-[18px]" />,
          shortcut: 'M',
        },
      ],
    },
    {
      label: 'Coordination',
      items: [
        {
          label: 'Emergency Alerts',
          path: '/emergency',
          icon: <AlertTriangle className="w-[18px] h-[18px]" />,
          shortcut: 'A',
        },
        {
          label: 'NDRRMC Queue',
          path: '/ndrrmc',
          icon: <ArrowUpRight className="w-[18px] h-[18px]" />,
          shortcut: 'N',
          superadminOnly: true,
        },
        {
          label: 'Reports',
          path: '/reports',
          icon: <FileText className="w-[18px] h-[18px]" />,
          shortcut: 'R',
        },
      ],
    },
    {
      label: 'Admin',
      items: [
        {
          label: 'Users',
          path: '/users',
          icon: <Users className="w-[18px] h-[18px]" />,
          shortcut: 'U',
        },
        {
          label: 'Shift Handoff',
          path: '/handoff',
          icon: <ArrowRightLeft className="w-[18px] h-[18px]" />,
        },
      ],
    },
    {
      label: 'System',
      items: [
        {
          label: 'Analytics',
          path: '/dashboard',
          icon: <LayoutDashboard className="w-[18px] h-[18px]" />,
          shortcut: 'D',
        },
        {
          label: 'Audit Logs',
          path: '/audit',
          icon: <ClipboardList className="w-[18px] h-[18px]" />,
          shortcut: 'L',
        },
        {
          label: 'System Health',
          path: '/health',
          icon: <Activity className="w-[18px] h-[18px]" />,
          shortcut: 'H',
          superadminOnly: true,
        },
        {
          label: 'SMS Audit',
          path: '/sms',
          icon: <MessageSquare className="w-[18px] h-[18px]" />,
          superadminOnly: true,
        },
        {
          label: 'Data Erasure',
          path: '/erasure',
          icon: <Eraser className="w-[18px] h-[18px]" />,
          superadminOnly: true,
        },
        {
          label: 'Settings',
          path: '/settings',
          icon: <Settings className="w-[18px] h-[18px]" />,
          shortcut: 'S',
        },
      ],
    },
  ]

  const visibleGroups = groups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => !item.superadminOnly || isSuperadmin),
    }))
    .filter((group) => group.items.length > 0)

  return (
    <aside
      className={cn(
        'fixed left-0 top-[56px] bottom-0 bg-white border-r border-border z-40 flex flex-col transition-all duration-200',
        sidebarCollapsed ? 'w-16' : 'w-[240px]',
      )}
    >
      <nav aria-label="Main navigation" className="flex-1 overflow-y-auto py-2">
        {visibleGroups.map((group, groupIdx) => (
          <div key={group.label} className={cn(groupIdx > 0 && 'mt-1')}>
            {!sidebarCollapsed ? (
              <p className="px-4 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50 select-none">
                {group.label}
              </p>
            ) : (
              groupIdx > 0 && <div className="mx-3 my-2 border-t border-border/50" />
            )}
            <ul>
              {group.items.map((item) => {
                const active = location.pathname === item.path
                return (
                  <li key={item.path} className="px-2">
                    <button
                      onClick={() => {
                        void navigate(item.path)
                      }}
                      aria-current={active ? 'page' : undefined}
                      title={
                        sidebarCollapsed
                          ? `${item.label}${item.shortcut ? ` (${item.shortcut})` : ''}`
                          : undefined
                      }
                      className={cn(
                        'w-full flex items-center gap-3 px-2.5 py-2 rounded-md text-sm transition-colors duration-150',
                        active
                          ? 'bg-muted text-foreground font-medium'
                          : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                      )}
                    >
                      <span className="shrink-0">{item.icon}</span>
                      {!sidebarCollapsed && (
                        <>
                          <span className="flex-1 text-left">{item.label}</span>
                          {item.badge !== undefined && item.badge > 0 ? (
                            <span className="min-w-[18px] h-[18px] px-1 flex items-center justify-center bg-foreground text-background text-[10px] font-semibold rounded-full leading-none">
                              {item.badge > 99 ? '99+' : String(item.badge)}
                            </span>
                          ) : (
                            item.shortcut && (
                              <kbd className="px-1 py-0.5 bg-muted border border-border/60 rounded text-[10px] font-mono text-muted-foreground/60">
                                {item.shortcut}
                              </kbd>
                            )
                          )}
                        </>
                      )}
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </nav>

      <button
        onClick={toggleSidebar}
        aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        className="w-full py-2 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors text-center border-t border-border text-xs"
      >
        {sidebarCollapsed ? '→' : '←'}
      </button>
    </aside>
  )
}
