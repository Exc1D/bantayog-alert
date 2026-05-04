import { useState, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Download,
  Eye,
  Search,
  ShieldAlert,
  Activity,
  CheckCircle,
  LogIn,
  LogOut,
  FileText,
  AlertTriangle,
  Radio,
  Zap,
  ChevronLeft,
  ChevronRight,
  User,
} from 'lucide-react'
import { format, parseISO, isWithinInterval, subDays } from 'date-fns'
import { useDataStore } from '@/stores/dataStore'
import { useUIStore } from '@/stores/uiStore'
import { SlideInPanel } from '@/components/layout/SlideInPanel'
import { AppShell } from '@/components/layout/AppShell'
import type { AuditLogEntry } from '@/types'
import { cn } from '@/lib/utils'

type DateRange = 'today' | '7d' | '30d' | 'all'

const actionMeta: Record<string, { icon: React.ReactNode; category: string }> = {
  LOGIN: { icon: <LogIn className="w-4 h-4" />, category: 'Authentication' },
  LOGOUT: { icon: <LogOut className="w-4 h-4" />, category: 'Authentication' },
  VIEW_PRIVATE_DATA: { icon: <ShieldAlert className="w-4 h-4" />, category: 'Private Data' },
  DISPATCH_RESPONDER: { icon: <Zap className="w-4 h-4" />, category: 'Dispatch' },
  UPDATE_STATUS: { icon: <Activity className="w-4 h-4" />, category: 'Incident' },
  ESCALATE: { icon: <ChevronRight className="w-4 h-4" />, category: 'NDRRMC' },
  APPROVE_ESCALATION: { icon: <CheckCircle className="w-4 h-4" />, category: 'NDRRMC' },
  CREATE_USER: { icon: <User className="w-4 h-4" />, category: 'User' },
  AUTO_REFRESH: { icon: <Radio className="w-4 h-4" />, category: 'System' },
  EXPORT_REPORT: { icon: <FileText className="w-4 h-4" />, category: 'System' },
  DECLARE_EMERGENCY: { icon: <AlertTriangle className="w-4 h-4" />, category: 'Emergency' },
}

function actionDisplay(action: string) {
  return action.replace(/_/g, ' ')
}

function resultBadge(result: string) {
  if (result === 'Failed')
    return {
      text: 'Failed',
      color: 'text-red-700',
      bg: 'bg-red-50',
      border: 'border-red-200',
      dot: 'bg-red-700',
    }
  if (result === 'Warning')
    return {
      text: 'Warning',
      color: 'text-amber-700',
      bg: 'bg-amber-50',
      border: 'border-amber-200',
      dot: 'bg-amber-700',
    }
  return {
    text: 'Success',
    color: 'text-green-700',
    bg: 'bg-green-50',
    border: 'border-green-200',
    dot: 'bg-green-700',
  }
}

const roleColors: Record<string, string> = {
  SUPERADMIN: 'text-purple-700 bg-purple-50 border-purple-200',
  PROVINCIAL_ADMIN: 'text-accent bg-accent/10 border-accent/30',
  MUNICIPAL_ADMIN: 'text-amber-700 bg-amber-50 border-amber-200',
  AGENCY_ADMIN: 'text-orange-700 bg-orange-50 border-orange-200',
  RESPONDER: 'text-green-700 bg-green-50 border-green-200',
  CITIZEN: 'text-muted-foreground bg-muted border-border',
}

export default function AuditPage() {
  const { auditLog } = useDataStore()
  const { addToast } = useUIStore()

  const [dateRange, setDateRange] = useState<DateRange>('7d')
  const [actorRole, setActorRole] = useState<string>('all')
  const [actionType, setActionType] = useState<string>('all')
  const [privateOnly, setPrivateOnly] = useState(false)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [streaming, setStreaming] = useState(false)
  const [detailEntry, setDetailEntry] = useState<AuditLogEntry | null>(null)

  const [entries] = useState<AuditLogEntry[]>([...auditLog])

  const filtered = useMemo(() => {
    const now = new Date()
    return entries
      .filter((entry) => {
        const ts = parseISO(entry.timestamp)
        if (dateRange === 'today' && !isWithinInterval(ts, { start: subDays(now, 1), end: now }))
          return false
        if (dateRange === '7d' && !isWithinInterval(ts, { start: subDays(now, 7), end: now }))
          return false
        if (dateRange === '30d' && !isWithinInterval(ts, { start: subDays(now, 30), end: now }))
          return false
        if (actorRole !== 'all' && entry.actorRole !== actorRole) return false
        if (actionType !== 'all' && entry.action !== actionType) return false
        if (privateOnly && !entry.privateDataAccessed) return false
        if (search) {
          const q = search.toLowerCase()
          const hay =
            `${entry.actorName} ${entry.action} ${entry.targetId ?? ''} ${entry.details}`.toLowerCase()
          if (!hay.includes(q)) return false
        }
        return true
      })
      .sort((a, b) => +parseISO(b.timestamp) - +parseISO(a.timestamp))
  }, [entries, dateRange, actorRole, actionType, privateOnly, search])

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize)

  const stats = useMemo(() => {
    const total = filtered.length
    const priv = filtered.filter((e) => e.privateDataAccessed).length
    const failed = filtered.filter((e) => e.action === 'Failed' || e.action.includes('FAIL')).length
    const system = filtered.filter((e) => e.actorId === 'system').length
    return { total, priv, failed, system }
  }, [filtered])

  const handleExport = useCallback(() => {
    addToast({
      title: 'Export Started',
      message: `Preparing ${String(filtered.length)} audit entries for export.`,
      type: 'info',
    })
    setTimeout(() => {
      addToast({ title: 'Export Complete', message: 'Audit log exported as CSV.', type: 'success' })
    }, 1500)
  }, [addToast, filtered.length])

  const uniqueRoles = useMemo(() => Array.from(new Set(entries.map((e) => e.actorRole))), [entries])
  const uniqueActions = useMemo(() => Array.from(new Set(entries.map((e) => e.action))), [entries])

  return (
    <AppShell>
      <div className="p-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Audit Log Viewer</h1>
            <p className="text-body-sm text-muted-foreground mt-1">
              Complete audit trail of all system actions
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setStreaming((s) => !s)
              }}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-md text-body-sm font-medium border transition-all',
                streaming
                  ? 'bg-green-50 text-green-700 border-green-200'
                  : 'bg-muted text-muted-foreground border-border hover:bg-white',
              )}
            >
              <span
                className={cn(
                  'w-2 h-2 rounded-full',
                  streaming ? 'bg-green-700 animate-pulse-soft' : 'bg-muted-foreground/70',
                )}
              />
              {streaming ? 'Streaming' : 'Stream Live'}
            </button>
            <button
              onClick={handleExport}
              className="flex items-center gap-2 px-4 py-2 rounded-md bg-muted text-foreground border border-border hover:bg-white transition-all text-body-sm"
            >
              <Download className="w-4 h-4" /> Export
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <StatCard label="Total Entries" value={stats.total} color="text-foreground" />
          <StatCard
            label="Private Data Access"
            value={stats.priv}
            color="text-red-700"
            onClick={() => {
              setPrivateOnly((p) => !p)
            }}
            active={privateOnly}
          />
          <StatCard label="Failed Actions" value={stats.failed} color="text-red-700" />
          <StatCard label="System Actions" value={stats.system} color="text-green-700" />
        </div>

        <div className="bg-white border border-border rounded-lg p-4 mb-4 flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Date Range</span>
            <select
              value={dateRange}
              onChange={(e) => {
                setDateRange(e.target.value as DateRange)
                setPage(1)
              }}
              className="bg-white border border-border rounded-md px-3 py-2 text-body-sm text-foreground focus:border-accent focus:outline-none"
            >
              <option value="today">Today</option>
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="all">All time</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Actor Role</span>
            <select
              value={actorRole}
              onChange={(e) => {
                setActorRole(e.target.value)
                setPage(1)
              }}
              className="bg-white border border-border rounded-md px-3 py-2 text-body-sm text-foreground focus:border-accent focus:outline-none"
            >
              <option value="all">All Roles</option>
              {uniqueRoles.map((r) => (
                <option key={r} value={r}>
                  {r.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Action</span>
            <select
              value={actionType}
              onChange={(e) => {
                setActionType(e.target.value)
                setPage(1)
              }}
              className="bg-white border border-border rounded-md px-3 py-2 text-body-sm text-foreground focus:border-accent focus:outline-none"
            >
              <option value="all">All Actions</option>
              {uniqueActions.map((a) => (
                <option key={a} value={a}>
                  {actionDisplay(a)}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2 pb-2">
            <button
              onClick={() => {
                setPrivateOnly((p) => !p)
              }}
              className={cn(
                'flex items-center gap-2 px-3 py-2 rounded-md text-body-sm border transition-all',
                privateOnly
                  ? 'bg-red-50 text-red-700 border-red-200'
                  : 'bg-muted text-muted-foreground border-border',
              )}
            >
              <ShieldAlert className="w-4 h-4" />
              Private Data Only
            </button>
          </div>
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/70" />
              <input
                type="text"
                placeholder="Search by actor, action, target, ID..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  setPage(1)
                }}
                className="w-full bg-white border border-border rounded-md pl-9 pr-4 py-2 text-body-sm text-foreground placeholder:text-muted-foreground/70 focus:border-accent focus:outline-none"
              />
            </div>
          </div>
        </div>

        <div className="bg-white border border-border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="data-table-header text-left">
                  <th className="py-3 px-4 w-[15%]">Timestamp</th>
                  <th className="py-3 px-4 w-[15%]">Actor</th>
                  <th className="py-3 px-4 w-[20%]">Action</th>
                  <th className="py-3 px-4 w-[20%]">Target</th>
                  <th className="py-3 px-4 w-[10%] text-center">Result</th>
                  <th className="py-3 px-4 w-[8%] text-center">Private</th>
                  <th className="py-3 px-4 w-[12%] text-right">Details</th>
                </tr>
              </thead>
              <tbody>
                <AnimatePresence>
                  {paged.map((entry, idx) => {
                    const meta = actionMeta[entry.action] ?? {
                      icon: <FileText className="w-4 h-4" />,
                      category: 'Other',
                    }
                    const roleStyle = roleColors[entry.actorRole] ?? roleColors.CITIZEN
                    const isPrivate = entry.privateDataAccessed
                    const isSystem = entry.actorId === 'system'
                    const badge = resultBadge(isPrivate ? 'Failed' : 'Success')
                    return (
                      <motion.tr
                        key={entry.id}
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, delay: idx * 0.03 }}
                        onClick={() => {
                          setDetailEntry(entry)
                        }}
                        className={cn(
                          'data-table-row cursor-pointer',
                          isPrivate && 'border-l-[3px] border-l-red-700 bg-red-50/30',
                          !isPrivate && 'border-l-[3px] border-l-transparent',
                        )}
                      >
                        <td className="py-3 px-4">
                          <div className="font-mono text-mono-sm text-foreground">
                            {format(parseISO(entry.timestamp), 'HH:mm:ss')}
                          </div>
                          <div className="text-xs text-muted-foreground/70">
                            {format(parseISO(entry.timestamp), 'MMM d, yyyy')}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <div
                              className={cn(
                                'w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium',
                                isSystem
                                  ? 'bg-muted text-muted-foreground/70'
                                  : 'bg-muted text-foreground',
                              )}
                            >
                              {entry.actorName.charAt(0)}
                            </div>
                            <div>
                              <div
                                className={cn(
                                  'text-body-sm',
                                  isSystem ? 'text-muted-foreground/70' : 'text-foreground',
                                )}
                              >
                                {entry.actorName}
                              </div>
                              <span
                                className={cn(
                                  'inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium border',
                                  roleStyle,
                                )}
                              >
                                {entry.actorRole.replace(/_/g, ' ')}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <span className={isPrivate ? 'text-red-700' : 'text-muted-foreground'}>
                              {meta.icon}
                            </span>
                            <div>
                              <div
                                className={cn(
                                  'text-body-sm',
                                  isPrivate ? 'text-red-700' : 'text-foreground',
                                )}
                              >
                                {actionDisplay(entry.action)}
                              </div>
                              <div className="text-xs text-muted-foreground/70">
                                {meta.category}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          {entry.targetId ? (
                            <div>
                              <div className="font-mono text-mono-sm text-accent">
                                {entry.targetType} #{entry.targetId}
                              </div>
                            </div>
                          ) : (
                            <span className="text-body-sm text-muted-foreground">
                              {entry.targetType}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span
                            className={cn(
                              'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border',
                              badge.bg,
                              badge.color,
                              badge.border,
                            )}
                          >
                            <span className={cn('w-1.5 h-1.5 rounded-full', badge.dot)} />
                            {badge.text}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          {isPrivate && <ShieldAlert className="w-4 h-4 text-red-700 mx-auto" />}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setDetailEntry(entry)
                            }}
                            className="text-accent text-body-sm hover:underline inline-flex items-center gap-1"
                          >
                            View <Eye className="w-3 h-3" />
                          </button>
                        </td>
                      </motion.tr>
                    )
                  })}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
          {paged.length === 0 && (
            <div className="py-10 text-center">
              <ShieldAlert className="w-12 h-12 text-muted-foreground/70 mx-auto mb-3" />
              <p className="text-body-md text-muted-foreground">
                No audit entries match your filters
              </p>
              <button
                onClick={() => {
                  setSearch('')
                  setActorRole('all')
                  setActionType('all')
                  setPrivateOnly(false)
                  setDateRange('all')
                }}
                className="text-accent text-body-sm mt-2 hover:underline"
              >
                Clear filters
              </button>
            </div>
          )}

          <div className="flex items-center justify-between px-4 py-3 border-t border-border">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground/70">Rows per page:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value))
                  setPage(1)
                }}
                className="bg-white border border-border rounded px-2 py-1 text-xs text-foreground"
              >
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
              <span className="text-xs text-muted-foreground/70 ml-2">
                {filtered.length > 0
                  ? `${String((page - 1) * pageSize + 1)}-${String(Math.min(page * pageSize, filtered.length))} of ${String(filtered.length)}`
                  : '0 results'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => {
                  setPage((p) => p - 1)
                }}
                className="p-1 rounded hover:bg-muted disabled:opacity-30 text-muted-foreground"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-body-sm text-foreground">
                Page {page} of {totalPages}
              </span>
              <button
                disabled={page >= totalPages}
                onClick={() => {
                  setPage((p) => p + 1)
                }}
                className="p-1 rounded hover:bg-muted disabled:opacity-30 text-muted-foreground"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        <SlideInPanel
          open={!!detailEntry}
          onClose={() => {
            setDetailEntry(null)
          }}
          title="Audit Entry Details"
          width={480}
        >
          {detailEntry && <AuditDetail entry={detailEntry} />}
        </SlideInPanel>
      </div>
    </AppShell>
  )
}

function StatCard({
  label,
  value,
  color,
  onClick,
  active,
}: {
  label: string
  value: number
  color: string
  onClick?: () => void
  active?: boolean
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'metric-card text-left transition-all',
        onClick && 'cursor-pointer hover:border-accent',
        active && 'border-accent',
      )}
    >
      <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">{label}</div>
      <div className={cn('text-display-md font-mono', color)}>{value.toLocaleString()}</div>
    </button>
  )
}

function AuditDetail({ entry }: { entry: AuditLogEntry }) {
  const meta = actionMeta[entry.action] ?? {
    icon: <FileText className="w-4 h-4" />,
    category: 'Other',
  }
  return (
    <div className="space-y-5">
      <div className="bg-muted border border-border rounded-lg p-4">
        <div className="text-xs text-muted-foreground mb-1">Entry ID</div>
        <div className="font-mono text-mono-sm text-accent">#{entry.id.toUpperCase()}</div>
      </div>

      <div className="bg-muted border border-border rounded-lg p-4 space-y-3">
        <div>
          <div className="text-xs text-muted-foreground mb-1">Timestamp</div>
          <div className="font-mono text-mono-sm text-foreground">
            {format(parseISO(entry.timestamp), 'yyyy-MM-dd HH:mm:ss')}
          </div>
          <div className="text-xs text-muted-foreground/70">
            {format(parseISO(entry.timestamp), 'PPP')} &mdash;{' '}
            {format(parseISO(entry.timestamp), 'pp')}
          </div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground mb-1">Actor</div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-body-sm text-foreground">
              {entry.actorName.charAt(0)}
            </div>
            <div>
              <div className="text-body-sm text-foreground">{entry.actorName}</div>
              <span
                className={cn(
                  'inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium border',
                  roleColors[entry.actorRole] ?? roleColors.CITIZEN,
                )}
              >
                {entry.actorRole.replace(/_/g, ' ')}
              </span>
            </div>
          </div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground mb-1">Action</div>
          <div className="flex items-center gap-2">
            {meta.icon}
            <span className="text-body-sm text-foreground">{actionDisplay(entry.action)}</span>
          </div>
          <div className="text-xs text-muted-foreground/70 mt-0.5">Category: {meta.category}</div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground mb-1">Target</div>
          <div className="font-mono text-mono-sm text-accent">
            {entry.targetType} {entry.targetId ? `#${entry.targetId}` : ''}
          </div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground mb-1">Details</div>
          <div className="text-body-sm text-foreground">{entry.details}</div>
        </div>
        {entry.ipAddress && (
          <div>
            <div className="text-xs text-muted-foreground mb-1">IP Address</div>
            <div className="font-mono text-mono-sm text-muted-foreground/70">{entry.ipAddress}</div>
          </div>
        )}
        {entry.privateDataAccessed && (
          <div className="bg-red-50 border border-red-200 rounded-md p-3 flex items-start gap-2">
            <ShieldAlert className="w-4 h-4 text-red-700 mt-0.5 shrink-0" />
            <div>
              <div className="text-body-sm text-red-700 font-medium">Private Data Access</div>
              <div className="text-xs text-muted-foreground">
                This entry logged access to private citizen data. RA 10173 compliance.
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
