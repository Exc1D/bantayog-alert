import { useState, useEffect, Fragment, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { MetricCard } from '@/components/common/MetricCard'
import { useDataStore } from '@/stores/dataStore'
import { useUIStore } from '@/stores/uiStore'
import { cn } from '@/lib/utils'
import {
  RefreshCw,
  AlertTriangle,
  Download,
  Users,
  ArrowUpRight,
  X,
  CheckCircle,
  Truck,
  User,
  Settings,
  AlertCircle,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
} from 'recharts'
import {
  dailyIncidentTrend,
  dailyResponseTimeTrend,
  severityHeatmapData,
  incidentTypeDistribution,
  municipalPerformances,
  anomalyAlerts,
  activityEvents,
} from '@/data/mockData'
import type { ActivityEvent } from '@/types'

const CHART_TOOLTIP_STYLE = {
  backgroundColor: '#ffffff',
  border: '1px solid #dfe3e8',
  borderRadius: '6px',
  color: '#0f1419',
}
const CHART_LABEL_STYLE = { color: '#6b7280', fontSize: 12 }
const CHART_TICK = { fill: '#6b7280', fontSize: 12 }

const INCIDENT_TYPE_COLORS: Record<string, string> = {
  FLOOD: 'bg-blue-500',
  FIRE: 'bg-red-600',
  LANDSLIDE: 'bg-amber-600',
  ACCIDENT: 'bg-purple-600',
  MEDICAL: 'bg-green-600',
  OTHER: 'bg-muted-foreground',
}

export default function DashboardPage() {
  const navigate = useNavigate()
  const { lastUpdated, refreshData } = useDataStore()
  const { addToast } = useUIStore()
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [activityFilter, setActivityFilter] = useState<
    'all' | 'incidents' | 'responders' | 'escalations' | 'system'
  >('all')
  const [dismissedAnomalies, setDismissedAnomalies] = useState<string[]>([])
  const [timeAgo, setTimeAgo] = useState(0)

  const handleRefresh = useCallback(() => {
    setRefreshing(true)
    refreshData()
    setTimeAgo(0)
    setTimeout(() => {
      setRefreshing(false)
    }, 800)
  }, [refreshData])

  useEffect(() => {
    if (!autoRefresh) return
    const interval = setInterval(() => {
      handleRefresh()
    }, 30000)
    return () => {
      clearInterval(interval)
    }
  }, [autoRefresh, handleRefresh])

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeAgo((t) => t + 1)
    }, 1000)
    return () => {
      clearInterval(interval)
    }
  }, [lastUpdated])

  const activeIncidents = 47
  const activeResponders = 128
  const avgResponseTime = '14:32'
  const unresolvedOver24h = 9
  const ndrrmcPending = 3
  const municipalitiesAffected = 8

  const visibleAnomalies = anomalyAlerts.filter((a) => !dismissedAnomalies.includes(a.id))

  const filteredActivity = activityEvents.filter((e) => {
    if (activityFilter === 'all') return true
    if (activityFilter === 'incidents') return e.type === 'INCIDENT'
    if (activityFilter === 'responders') return e.type === 'DISPATCH'
    if (activityFilter === 'escalations') return e.type === 'ESCALATION'
    return e.type === 'SYSTEM'
  })

  const incidentTypeTotal = incidentTypeDistribution.reduce((s, i) => s + i.count, 0)

  return (
    <AppShell>
      <div className="sticky top-0 z-10 bg-white border-b border-border -mx-6 px-6 py-3 flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-pulse-ring absolute inline-flex h-full w-full rounded-full bg-green-600 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-600" />
            </span>
            <span className="text-xs text-green-700 uppercase tracking-wider font-medium">
              LIVE
            </span>
          </div>
          <span className="text-sm text-muted-foreground">
            Updated <span className="font-mono text-sm">{String(timeAgo)}s</span> ago
          </span>
          <button
            onClick={() => {
              setAutoRefresh(!autoRefresh)
            }}
            className={cn(
              'text-xs px-2 py-1 rounded border transition-colors',
              autoRefresh
                ? 'bg-green-50 border-green-200 text-green-700'
                : 'bg-muted border-border text-muted-foreground/70',
            )}
          >
            Auto
          </button>
          <button
            onClick={handleRefresh}
            className={cn(
              'p-1.5 rounded-md text-muted-foreground/70 hover:text-foreground hover:bg-muted transition-colors',
              refreshing && 'animate-spin',
            )}
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              void navigate('/emergency')
            }}
            className="flex items-center gap-2 px-4 py-2 bg-red-700 text-white rounded-md text-sm font-medium hover:brightness-110 transition-all"
          >
            <AlertTriangle className="w-4 h-4" />
            Declare Alerts
          </button>
          <button
            onClick={() => {
              addToast({
                title: 'Shift Handoff',
                message: 'Opening shift handoff...',
                type: 'info',
              })
              void navigate('/handoff')
            }}
            className="flex items-center gap-2 px-4 py-2 bg-muted border border-border text-foreground rounded-md text-sm hover:bg-white transition-colors"
          >
            <Users className="w-4 h-4" />
            Shift Handoff
          </button>
          <button
            onClick={() => {
              addToast({ title: 'Export', message: 'Report export started...', type: 'success' })
            }}
            className="flex items-center gap-2 px-4 py-2 bg-muted border border-border text-foreground rounded-md text-sm hover:bg-white transition-colors"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
          <button
            onClick={() => {
              void navigate('/ndrrmc')
            }}
            className="flex items-center gap-2 px-4 py-2 bg-muted border border-border text-purple-700 rounded-md text-sm hover:bg-purple-50 transition-colors"
          >
            <ArrowUpRight className="w-4 h-4" />
            NDRRMC Queue
            <span className="px-1.5 py-0.5 bg-purple-100 text-purple-700 text-[10px] font-medium rounded">
              2
            </span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
        <MetricCard
          title="ACTIVE INCIDENTS"
          value={String(activeIncidents)}
          subtitle="Province-wide"
          trend={{ value: '+12 from yesterday', direction: 'up', positive: false }}
          live
          onClick={() => {
            addToast({
              title: 'Incidents',
              message: 'Viewing all active incidents...',
              type: 'info',
            })
          }}
        >
          <div className="flex items-center gap-2 mt-2 text-xs">
            <span className="text-red-700">24 HIGH</span>
            <span className="text-muted-foreground/70">·</span>
            <span className="text-amber-700">15 MED</span>
            <span className="text-muted-foreground/70">·</span>
            <span className="text-green-700">8 LOW</span>
          </div>
        </MetricCard>

        <MetricCard
          title="ACTIVE RESPONDERS"
          value={String(activeResponders)}
          subtitle="On duty now"
          trend={{ value: '+5 from 1h ago', direction: 'up', positive: true }}
          live
        >
          <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
            <span>BFP:24</span>
            <span>PNP:45</span>
            <span>PCG:12</span>
            <span>PRC:18</span>
            <span>DPWH:29</span>
          </div>
        </MetricCard>

        <MetricCard
          title="AVG RESPONSE TIME"
          value={avgResponseTime}
          subtitle="Province-wide average"
          trend={{ value: '-2:15 from last week', direction: 'down', positive: true }}
        >
          <div className="mt-2 text-xs text-green-700">Target: &lt;15:00</div>
        </MetricCard>

        <MetricCard
          title="UNRESOLVED >24H"
          value={String(unresolvedOver24h)}
          subtitle="Require attention"
          trend={{ value: '+3 from yesterday', direction: 'up', positive: false }}
          className="[&_.text-\\[36px\\]]:text-red-700"
        >
          <span className="mt-2 inline-block px-2 py-0.5 bg-red-50 text-red-700 text-xs rounded border border-red-200">
            CRITICAL
          </span>
        </MetricCard>

        <MetricCard
          title="NDRRMC PENDING"
          value={String(ndrrmcPending)}
          subtitle="Awaiting review"
          className="[&_.text-\\[36px\\]]:text-purple-700"
        >
          <div className="mt-2 text-xs text-amber-700">Oldest: 4h 12m</div>
          <button
            onClick={() => {
              void navigate('/ndrrmc')
            }}
            className="mt-1 text-xs text-accent hover:underline"
          >
            Review →
          </button>
        </MetricCard>

        <MetricCard
          title="MUNIS AFFECTED"
          value={`${String(municipalitiesAffected)}/12`}
          subtitle="Municipalities with active incidents"
        >
          <div className="mt-2 text-xs text-muted-foreground truncate">
            Basud, Daet, Jose Panganiban, Labo, Mercedes, Paracale, Talisay, Vinzons
          </div>
          <div className="mt-2 grid grid-cols-4 gap-1">
            {[
              'Basud',
              'Capalonga',
              'Daet',
              'Jose Panganiban',
              'Labo',
              'Mercedes',
              'Paracale',
              'San Lorenzo Ruiz',
              'San Vicente',
              'Santa Elena',
              'Talisay',
              'Vinzons',
            ].map((m) => {
              const active = [
                'Basud',
                'Daet',
                'Jose Panganiban',
                'Labo',
                'Mercedes',
                'Paracale',
                'Talisay',
                'Vinzons',
              ].includes(m)
              return (
                <div
                  key={m}
                  className={cn('w-2 h-2 rounded-full', active ? 'bg-accent' : 'bg-border')}
                  title={m}
                />
              )
            })}
          </div>
        </MetricCard>
      </div>

      <AnimatePresence>
        {visibleAnomalies.map((anomaly) => (
          <motion.div
            key={anomaly.id}
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{
              duration: 0.4,
              ease: [0.16, 1, 0.3, 1] as [number, number, number, number],
            }}
            className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg border-l-4 border-l-red-500"
          >
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-700 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-red-700">ANOMALY DETECTED</p>
                <p className="text-base text-foreground mt-1">{anomaly.message}</p>
                <p className="text-xs text-muted-foreground/70 font-mono mt-1">
                  Detected {timeSince(anomaly.detectedAt)}
                </p>
              </div>
              <button
                onClick={() => {
                  setDismissedAnomalies((prev) => [...prev, anomaly.id])
                }}
                className="text-muted-foreground/70 hover:text-foreground transition-colors p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mb-6">
        <div className="lg:col-span-3 space-y-6">
          <div className="bg-white border border-border rounded-lg p-5">
            <h3 className="text-lg font-semibold text-foreground mb-4">7-Day Incident Trends</h3>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={dailyIncidentTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                <XAxis
                  dataKey="day"
                  stroke="#6b7280"
                  tick={CHART_TICK}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis stroke="#6b7280" tick={CHART_TICK} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={CHART_TOOLTIP_STYLE}
                  itemStyle={{ fontSize: 12 }}
                  labelStyle={CHART_LABEL_STYLE}
                />
                <Line
                  type="monotone"
                  dataKey="high"
                  stroke="#dc2626"
                  strokeWidth={2}
                  dot={{ r: 3, fill: '#dc2626' }}
                  name="HIGH"
                />
                <Line
                  type="monotone"
                  dataKey="medium"
                  stroke="#d97706"
                  strokeWidth={2}
                  dot={{ r: 3, fill: '#d97706' }}
                  name="MEDIUM"
                />
                <Line
                  type="monotone"
                  dataKey="low"
                  stroke="#16a34a"
                  strokeWidth={2}
                  dot={{ r: 3, fill: '#16a34a' }}
                  name="LOW"
                />
                <Line
                  type="monotone"
                  dataKey="total"
                  stroke="#9ca3af"
                  strokeWidth={1}
                  strokeDasharray="5 5"
                  dot={false}
                  name="Total"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white border border-border rounded-lg p-5">
            <h3 className="text-lg font-semibold text-foreground mb-4">Response Time Trend</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={dailyResponseTimeTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                <XAxis
                  dataKey="day"
                  stroke="#6b7280"
                  tick={CHART_TICK}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis stroke="#6b7280" tick={CHART_TICK} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={CHART_TOOLTIP_STYLE}
                  itemStyle={{ fontSize: 12 }}
                  labelStyle={CHART_LABEL_STYLE}
                />
                <Bar dataKey="avgTime" radius={[4, 4, 0, 0]}>
                  {dailyResponseTimeTrend.map((entry, index) => (
                    // eslint-disable-next-line @typescript-eslint/no-deprecated -- Cell is the standard recharts approach for per-bar colors
                    <Cell
                      key={index}
                      fill={
                        entry.avgTime < 15 ? '#16a34a' : entry.avgTime <= 20 ? '#d97706' : '#dc2626'
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white border border-border rounded-lg p-5">
            <h3 className="text-lg font-semibold text-foreground mb-4">Incident Types — 24h</h3>
            <div className="flex items-center gap-4">
              <div className="flex-1 h-10 flex rounded-md overflow-hidden">
                {incidentTypeDistribution.map((item) => {
                  const pct = (item.count / incidentTypeTotal) * 100
                  return (
                    <div
                      key={item.type}
                      className={cn(
                        INCIDENT_TYPE_COLORS[item.type],
                        'h-full flex items-center justify-center',
                      )}
                      style={{ width: `${String(pct)}%`, minWidth: pct > 8 ? 'auto' : '0' }}
                      title={`${item.label}: ${String(item.count)} (${pct.toFixed(1)}%)`}
                    >
                      {pct > 12 && (
                        <span className="text-xs text-white font-medium">{item.label}</span>
                      )}
                    </div>
                  )
                })}
              </div>
              <span className="text-sm text-muted-foreground font-mono shrink-0">
                Total: {String(incidentTypeTotal)}
              </span>
            </div>
            <div className="flex flex-wrap gap-4 mt-3">
              {incidentTypeDistribution.map((item) => {
                return (
                  <div
                    key={item.type}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground"
                  >
                    <span className={cn('w-2 h-2 rounded-full', INCIDENT_TYPE_COLORS[item.type])} />
                    <span>{item.label}</span>
                    <span className="font-mono text-muted-foreground/70">{String(item.count)}</span>
                    <span className="text-muted-foreground/70">
                      ({((item.count / incidentTypeTotal) * 100).toFixed(0)}%)
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white border border-border rounded-lg p-5">
            <h3 className="text-lg font-semibold text-foreground mb-1">Municipal Performance</h3>
            <p className="text-xs text-muted-foreground/70 mb-4">Click a row to view details</p>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="data-table-header text-left">Municipality</th>
                    <th className="data-table-header text-right">Active</th>
                    <th className="data-table-header text-right">Rspdr</th>
                    <th className="data-table-header text-right">Avg</th>
                    <th className="data-table-header text-right">&gt;24h</th>
                  </tr>
                </thead>
                <tbody>
                  {municipalPerformances
                    .sort((a, b) => b.activeIncidents - a.activeIncidents)
                    .map((m) => {
                      const timeParts = m.avgResponseTime.split(':')
                      const minutes =
                        parseInt(timeParts[0] ?? '0') * 60 + parseInt(timeParts[1] ?? '0')
                      return (
                        <tr key={m.municipality} className="data-table-row border-b border-border">
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <span
                                className={cn(
                                  'w-2 h-2 rounded-full',
                                  m.activeIncidents > 0 ? 'bg-green-600' : 'bg-muted-foreground/70',
                                )}
                              />
                              <span className="text-sm text-foreground font-medium">
                                {m.municipality}
                              </span>
                            </div>
                          </td>
                          <td
                            className={cn(
                              'py-3 px-4 text-right font-mono text-sm',
                              m.activeIncidents > 20
                                ? 'text-red-700'
                                : m.activeIncidents > 10
                                  ? 'text-amber-700'
                                  : 'text-foreground',
                            )}
                          >
                            {String(m.activeIncidents)}
                          </td>
                          <td className="py-3 px-4 text-right font-mono text-sm text-muted-foreground">
                            {String(m.activeResponders)}
                          </td>
                          <td
                            className={cn(
                              'py-3 px-4 text-right font-mono text-sm',
                              minutes > 1200
                                ? 'text-red-700'
                                : minutes > 900
                                  ? 'text-amber-700'
                                  : 'text-green-700',
                            )}
                          >
                            {m.avgResponseTime === '00:00' ? '—' : m.avgResponseTime}
                          </td>
                          <td
                            className={cn(
                              'py-3 px-4 text-right font-mono text-sm',
                              m.unresolvedOver24h > 0 ? 'text-red-700' : 'text-muted-foreground/70',
                            )}
                          >
                            {String(m.unresolvedOver24h)}
                          </td>
                        </tr>
                      )
                    })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white border border-border rounded-lg p-5">
            <h3 className="text-lg font-semibold text-foreground mb-4">
              Severity by Municipality — 7 Days
            </h3>
            <div className="overflow-x-auto">
              <div className="min-w-[400px]">
                <div className="grid grid-cols-8 gap-1">
                  <div className="text-xs text-muted-foreground/70" />
                  {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
                    <div key={d} className="text-center text-xs text-muted-foreground/70 py-1">
                      {d}
                    </div>
                  ))}
                  {severityHeatmapData.map((row) => (
                    <Fragment key={row.municipality}>
                      <div
                        className="text-xs text-muted-foreground py-1 truncate"
                        title={row.municipality}
                      >
                        {row.municipality}
                      </div>
                      {(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const).map((day) => {
                        const val = row[day]
                        const color =
                          val === 0
                            ? 'bg-muted'
                            : val <= 2
                              ? 'bg-heat-low'
                              : val <= 5
                                ? 'bg-heat-mid'
                                : val <= 10
                                  ? 'bg-heat-high'
                                  : 'bg-heat-critical'
                        return (
                          <div
                            key={day}
                            className={cn(
                              'aspect-square rounded-sm flex items-center justify-center',
                              color,
                            )}
                            title={`${row.municipality} ${day}: ${String(val)} incidents`}
                          >
                            {val > 0 && (
                              <span className="text-[10px] font-mono text-foreground">
                                {String(val)}
                              </span>
                            )}
                          </div>
                        )
                      })}
                    </Fragment>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white border border-border rounded-lg p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-foreground">Real-Time Activity</h3>
            <p className="text-xs text-muted-foreground/70">Latest province-wide events</p>
          </div>
          <div className="flex items-center gap-1">
            {(['all', 'incidents', 'responders', 'escalations', 'system'] as const).map((f) => (
              <button
                key={f}
                onClick={() => {
                  setActivityFilter(f)
                }}
                className={cn(
                  'px-3 py-1.5 rounded-md text-xs capitalize transition-colors',
                  activityFilter === f
                    ? 'text-foreground border-b-2 border-accent'
                    : 'text-muted-foreground/70 hover:text-muted-foreground',
                )}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
        <div className="max-h-[320px] overflow-y-auto space-y-2">
          {filteredActivity.map((event) => (
            <ActivityItem key={event.id} event={event} />
          ))}
        </div>
      </div>
    </AppShell>
  )
}

function ActivityItem({ event }: { event: ActivityEvent }) {
  const time = new Date(event.timestamp)
  const hours = String(time.getHours()).padStart(2, '0')
  const minutes = String(time.getMinutes()).padStart(2, '0')
  const seconds = String(time.getSeconds()).padStart(2, '0')

  const iconMap: Record<string, React.ReactNode> = {
    INCIDENT: <AlertCircle className="w-4 h-4 text-red-700" />,
    RESOLVED: <CheckCircle className="w-4 h-4 text-green-700" />,
    DISPATCH: <Truck className="w-4 h-4 text-accent" />,
    ESCALATION: <ArrowUpRight className="w-4 h-4 text-purple-700" />,
    USER: <User className="w-4 h-4 text-muted-foreground" />,
    SYSTEM: <Settings className="w-4 h-4 text-muted-foreground/70" />,
  }

  return (
    <div className="flex items-start gap-3 py-2 border-b border-border last:border-0">
      <div className="flex items-center gap-2 w-[100px] shrink-0">
        <span className="text-xs font-mono text-muted-foreground/70">
          {hours}:{minutes}:{seconds}
        </span>
      </div>
      <div className="shrink-0 mt-0.5">{iconMap[event.type]}</div>
      <div className="flex-1 min-w-0">
        <span className="text-xs text-muted-foreground">{event.actor}</span>
        <span className="text-sm text-foreground ml-1">{event.action}</span>
        {event.target && <span className="text-xs font-mono text-accent ml-1">{event.target}</span>}
      </div>
      {event.municipality && (
        <span className="text-xs text-muted-foreground/70 bg-muted px-2 py-0.5 rounded-full shrink-0">
          {event.municipality}
        </span>
      )}
    </div>
  )
}

function timeSince(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (seconds < 60) return `${String(seconds)}s ago`
  const mins = Math.floor(seconds / 60)
  if (mins < 60) return `${String(mins)}m ago`
  const hours = Math.floor(mins / 60)
  return `${String(hours)}h ${String(mins % 60)}m ago`
}
