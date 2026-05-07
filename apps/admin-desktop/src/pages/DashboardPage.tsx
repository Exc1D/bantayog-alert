import { useState, useEffect, Fragment } from 'react'
import { useNavigate } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { MetricCard } from '@/components/common/MetricCard'
import { ActivityFeed } from '@/components/dashboard/ActivityFeed'
import { useAuth } from '@bantayog/shared-ui'
import { useUIStore } from '@/stores/uiStore'
import { useDashboardLiveData } from '@/hooks/useDashboardLiveData'
import { useReportEvents } from '@/hooks/useReportEvents'
import { cn } from '@/lib/utils'
import { AlertTriangle, Download, Users, ArrowUpRight, X } from 'lucide-react'
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
} from '@/data/mockData'

const COLOR_DANGER = '#991b1b'
const COLOR_WARNING = '#92400e'
const COLOR_SUCCESS = '#065f46'

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

function SampleDataChip() {
  return (
    <span className="ml-2 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide bg-muted text-muted-foreground/70 border border-border rounded align-middle">
      Sample data
    </span>
  )
}

export default function DashboardPage() {
  const navigate = useNavigate()
  const { claims } = useAuth()
  const { addToast } = useUIStore()
  const municipalityId =
    typeof claims?.municipalityId === 'string' ? claims.municipalityId : undefined
  const data = useDashboardLiveData(municipalityId)
  const {
    events: activityEvents,
    error: activityError,
    loading: activityLoading,
  } = useReportEvents(municipalityId)

  const [dismissedAnomalies, setDismissedAnomalies] = useState<string[]>([])
  const [timeAgo, setTimeAgo] = useState(0)

  useEffect(() => {
    if (data.lastUpdated === null) return
    const ts = data.lastUpdated
    const interval = setInterval(() => {
      setTimeAgo(Math.floor((Date.now() - ts) / 1000))
    }, 1000)
    return () => {
      clearInterval(interval)
    }
  }, [data.lastUpdated])

  // No live source for NDRRMC pending yet — needs mass_alert_requests subscription
  const ndrrmcPending = 3

  const visibleAnomalies = data.anomalies.filter((a) => !dismissedAnomalies.includes(a.id))

  const activeNames = new Set(
    data.municipalData.filter((m) => m.activeIncidents > 0).map((m) => m.municipality),
  )

  const incidentTypeTotal = incidentTypeDistribution.reduce((s, i) => s + i.count, 0)

  return (
    <AppShell>
      <div className="sticky top-0 z-10 bg-white border-b border-border -mx-6 px-6 py-3 flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2" role="status" aria-label="Live data indicator">
            <span className="relative flex h-2 w-2">
              <span className="animate-pulse-ring absolute inline-flex h-full w-full rounded-full bg-green-600 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-600" />
            </span>
            <span className="text-xs text-green-700 uppercase tracking-wider font-medium">
              LIVE
            </span>
          </div>
          <span className="text-sm text-muted-foreground">
            {data.lastUpdated === null ? (
              'Connecting...'
            ) : (
              <>
                Updated <span className="font-mono text-sm">{String(timeAgo)}s</span> ago
              </>
            )}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              void navigate('/emergency')
            }}
            className="flex items-center gap-2 px-4 py-2 bg-[#a73400] text-white rounded-md text-sm font-medium hover:brightness-110 transition-all"
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
            className="flex items-center gap-2 px-4 py-2 bg-muted border border-border text-muted-foreground rounded-md text-sm hover:bg-white transition-colors"
          >
            <ArrowUpRight className="w-4 h-4" />
            NDRRMC Queue
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
        <MetricCard
          title="ACTIVE INCIDENTS"
          value={String(data.activeIncidents)}
          subtitle="Province-wide"
          live
          onClick={() => {
            addToast({
              title: 'Incidents',
              message: 'Viewing all active incidents...',
              type: 'info',
            })
          }}
        />

        <MetricCard
          title="ACTIVE RESPONDERS"
          value={String(data.respondersAvailable)}
          subtitle="Available now"
          live
        />

        <MetricCard title="AVG RESPONSE TIME" value={data.avgResponseTime} subtitle="Province-wide">
          <div className="mt-2 text-xs text-green-700">Target: &lt;15:00</div>
        </MetricCard>

        <MetricCard
          title="UNRESOLVED >24H"
          value={String(data.unresolvedOver24h)}
          subtitle="Require attention"
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
          value={`${String(data.municipalitiesAffected)}/12`}
          subtitle="With active incidents"
        >
          <div className="mt-2 text-xs text-muted-foreground truncate">
            {[...activeNames].slice(0, 4).join(', ')}
            {activeNames.size > 4 && ` +${String(activeNames.size - 4)} more`}
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
            ].map((m) => (
              <div
                key={m}
                className={cn(
                  'w-2 h-2 rounded-full',
                  activeNames.has(m) ? 'bg-accent' : 'bg-border',
                )}
                title={m}
              />
            ))}
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
            className="mb-4 p-4 bg-[#fee2e2] border border-[#991b1b] rounded-lg"
          >
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-[#991b1b] shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-[#991b1b]">ANOMALY DETECTED</p>
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
            <h3 className="text-lg font-semibold text-foreground mb-4">
              7-Day Incident Trends
              <SampleDataChip />
            </h3>
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
                  stroke={COLOR_DANGER}
                  strokeWidth={2}
                  dot={{ r: 3, fill: COLOR_DANGER }}
                  name="HIGH"
                />
                <Line
                  type="monotone"
                  dataKey="medium"
                  stroke={COLOR_WARNING}
                  strokeWidth={2}
                  dot={{ r: 3, fill: COLOR_WARNING }}
                  name="MEDIUM"
                />
                <Line
                  type="monotone"
                  dataKey="low"
                  stroke={COLOR_SUCCESS}
                  strokeWidth={2}
                  dot={{ r: 3, fill: COLOR_SUCCESS }}
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
            <h3 className="text-lg font-semibold text-foreground mb-4">
              Response Time Trend
              <SampleDataChip />
            </h3>
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
                        entry.avgTime < 15
                          ? COLOR_SUCCESS
                          : entry.avgTime <= 20
                            ? COLOR_WARNING
                            : COLOR_DANGER
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white border border-border rounded-lg p-5">
            <h3 className="text-lg font-semibold text-foreground mb-4">
              Incident Types — 24h
              <SampleDataChip />
            </h3>
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
              {incidentTypeDistribution.map((item) => (
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
              ))}
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white border border-border rounded-lg p-5">
            <h3 className="text-lg font-semibold text-foreground mb-1">Municipal Performance</h3>
            <p className="text-xs text-muted-foreground/70 mb-4">
              Live — updates on each report change
            </p>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="data-table-header text-left">Municipality</th>
                    <th className="data-table-header text-right">Active</th>
                    <th className="data-table-header text-right">Res.</th>
                    <th className="data-table-header text-right">Avg</th>
                    <th className="data-table-header text-right">&gt;24h</th>
                  </tr>
                </thead>
                <tbody>
                  {data.municipalData
                    .slice()
                    .sort((a, b) => b.activeIncidents - a.activeIncidents)
                    .map((m) => {
                      const minutes = parseInt(m.avgResponseTime.split(':')[0] ?? '0', 10)
                      return (
                        <tr
                          key={m.municipalityId}
                          className="data-table-row border-b border-border"
                        >
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
                            {String(m.resolvedToday)}
                          </td>
                          <td
                            className={cn(
                              'py-3 px-4 text-right font-mono text-sm',
                              minutes > 20
                                ? 'text-red-700'
                                : minutes > 15
                                  ? 'text-amber-700'
                                  : 'text-green-700',
                            )}
                          >
                            {m.avgResponseTime}
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
              <SampleDataChip />
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
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-foreground">Real-Time Activity</h3>
          <p className="text-xs text-muted-foreground/70">Latest province-wide events</p>
        </div>
        <ActivityFeed
          events={activityEvents}
          error={activityError}
          loading={activityLoading}
          maxVisible={20}
        />
      </div>
    </AppShell>
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
