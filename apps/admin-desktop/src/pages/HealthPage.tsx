import { useState, useMemo, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  Database,
  Radio,
  Cloud,
  MessageSquare,
  Bell,
  Activity,
  CheckCircle,
  RefreshCw,
  Flame,
} from 'lucide-react'
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts'
import { format, parseISO } from 'date-fns'
import { useDataStore } from '@/stores/dataStore'
import { useUIStore } from '@/stores/uiStore'
import { AppShell } from '@/components/layout/AppShell'
import { cn } from '@/lib/utils'
import type { SystemHealthMetric } from '@/types'

const CHART_TOOLTIP_STYLE = {
  backgroundColor: '#ffffff',
  border: '1px solid #dfe3e8',
  borderRadius: '6px',
  color: '#0f1419',
}

const firestoreData = Array.from({ length: 24 }, (_, i) => ({
  hour: `${String(i).padStart(2, '0')}:00`,
  reads: 1200 + Math.sin(i / 3) * 400 + Math.random() * 200,
  writes: 300 + Math.sin(i / 4) * 100 + Math.random() * 50,
}))

const latencyData = Array.from({ length: 24 }, (_, i) => ({
  hour: `${String(i).padStart(2, '0')}:00`,
  p95: 80 + Math.sin(i / 3) * 30 + Math.random() * 20,
  p99: 150 + Math.sin(i / 3) * 60 + Math.random() * 40,
}))

const rtdbData = Array.from({ length: 24 }, (_, i) => ({
  hour: `${String(i).padStart(2, '0')}:00`,
  connections: 1200 + Math.sin(i / 2) * 200 + Math.random() * 100,
}))

const throughputData = Array.from({ length: 24 }, (_, i) => ({
  hour: `${String(i).padStart(2, '0')}:00`,
  rpm: 450 + Math.sin(i / 3) * 150 + Math.random() * 50,
}))

interface DeadLetter {
  id: string
  time: string
  type: string
  error: string
  retries: number
  maxRetries: number
}

const initialDeadLetters: DeadLetter[] = [
  {
    id: 'dl-001',
    time: '2024-11-15T10:25:00Z',
    type: 'SMS',
    error: 'Provider timeout',
    retries: 3,
    maxRetries: 3,
  },
  {
    id: 'dl-002',
    time: '2024-11-15T10:18:00Z',
    type: 'FCM',
    error: 'Token expired',
    retries: 3,
    maxRetries: 3,
  },
  {
    id: 'dl-003',
    time: '2024-11-15T09:45:00Z',
    type: 'Function',
    error: 'Memory exceeded',
    retries: 2,
    maxRetries: 3,
  },
]

export default function HealthPage() {
  const { systemHealth, activityEvents } = useDataStore()
  const { addToast, openConfirmModal } = useUIStore()

  const [deadLetters, setDeadLetters] = useState<DeadLetter[]>(initialDeadLetters)
  const [prewarmOpen, setPrewarmOpen] = useState(false)
  const [prewarmLevel, setPrewarmLevel] = useState<'light' | 'heavy' | 'custom'>('light')
  const [prewarming, setPrewarming] = useState(false)
  const [prewarmProgress, setPrewarmProgress] = useState(0)
  const [eventFilter, setEventFilter] = useState<'all' | 'info' | 'warning' | 'critical'>('all')

  const overall = useMemo(() => {
    const hasDown = systemHealth.some((s) => s.status === 'DOWN')
    const hasDegraded = systemHealth.some((s) => s.status === 'DEGRADED')
    if (hasDown)
      return {
        label: 'System Issues Detected',
        color: 'text-red-700',
        dot: 'bg-red-700',
        pulse: true,
      }
    if (hasDegraded)
      return {
        label: 'Some Systems Degraded',
        color: 'text-amber-700',
        dot: 'bg-amber-700',
        pulse: false,
      }
    return {
      label: 'All Systems Operational',
      color: 'text-green-700',
      dot: 'bg-green-700',
      pulse: false,
    }
  }, [systemHealth])

  const systemEvents = useMemo(
    () =>
      activityEvents
        .filter((e) => e.type === 'SYSTEM' || e.type === 'DISPATCH')
        .slice(0, 20)
        .map((e) => ({
          ...e,
          severity: e.type === 'SYSTEM' ? 'info' : ('warning' as const),
        })),
    [activityEvents],
  )

  const filteredEvents = useMemo(() => {
    if (eventFilter === 'all') return systemEvents
    return systemEvents.filter((e) => e.severity === eventFilter)
  }, [systemEvents, eventFilter])

  const handlePrewarm = useCallback(() => {
    setPrewarming(true)
    setPrewarmProgress(0)
    const total = 24
    let current = 0
    const id = setInterval(() => {
      current += 1
      setPrewarmProgress(current)
      if (current >= total) {
        clearInterval(id)
        setPrewarming(false)
        setPrewarmOpen(false)
        addToast({
          title: 'Pre-warm Complete',
          message: 'All systems pre-warmed for surge traffic.',
          type: 'success',
        })
      }
    }, 200)
  }, [addToast])

  const handleRetryDeadLetter = useCallback(
    (id: string) => {
      addToast({ title: 'Retrying...', message: `Retrying dead letter ${id}`, type: 'info' })
      setTimeout(() => {
        setDeadLetters((prev) => prev.filter((d) => d.id !== id))
        addToast({
          title: 'Retry Success',
          message: `Dead letter ${id} processed successfully.`,
          type: 'success',
        })
      }, 1200)
    },
    [addToast],
  )

  const handleRetryAll = useCallback(() => {
    addToast({
      title: 'Retrying All...',
      message: `Retrying ${String(deadLetters.length)} dead letters`,
      type: 'info',
    })
    setTimeout(() => {
      setDeadLetters([])
      addToast({
        title: 'All Retried',
        message: 'All dead letters processed successfully.',
        type: 'success',
      })
    }, 1500)
  }, [deadLetters.length, addToast])

  return (
    <AppShell>
      <div className="p-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">System Health</h1>
            <p className="text-body-sm text-muted-foreground mt-1">
              Real-time infrastructure monitoring
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setPrewarmOpen(true)
              }}
              className="flex items-center gap-2 px-4 py-2 rounded-md bg-accent text-white hover:bg-accent-hover transition-all text-body-sm font-medium"
            >
              <Flame className="w-4 h-4" /> Pre-warm for Surge
            </button>
            <button
              onClick={() => {
                addToast({
                  title: 'Refreshing...',
                  message: 'Health metrics refreshed.',
                  type: 'info',
                })
              }}
              className="flex items-center gap-2 px-4 py-2 rounded-md bg-muted text-foreground border border-border hover:bg-white transition-all text-body-sm"
            >
              <RefreshCw className="w-4 h-4" /> Refresh
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-border">
          <span
            className={cn(
              'w-3 h-3 rounded-full',
              overall.dot,
              overall.pulse && 'animate-pulse-soft',
            )}
          />
          <h2 className={cn('text-lg font-semibold', overall.color)}>{overall.label}</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
          {systemHealth.map((svc) => (
            <StatusCard key={svc.service} metric={svc} />
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
          <div className="bg-white border border-border rounded-lg p-5">
            <h3 className="text-lg font-semibold text-foreground mb-4">Message Queue Depths</h3>
            <div className="space-y-4">
              <QueueBar
                label="SMS Outbox"
                value={systemHealth.find((s) => s.service === 'SMS Gateway')?.queueDepth ?? 0}
                max={1000}
              />
              <QueueBar label="FCM Push" value={156} max={500} />
              <QueueBar
                label="Function Invocations"
                value={systemHealth.find((s) => s.service === 'Cloud Functions')?.queueDepth ?? 0}
                max={100}
              />
            </div>
          </div>

          <div className="bg-white border border-border rounded-lg p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-foreground">Dead Letter Queue</h3>
              <span
                className={cn(
                  'text-display-md font-mono',
                  deadLetters.length > 0 ? 'text-red-700' : 'text-green-700',
                )}
              >
                {deadLetters.length}
              </span>
            </div>
            {deadLetters.length > 0 ? (
              <div className="space-y-2 max-h-[200px] overflow-y-auto">
                {deadLetters.map((dl) => (
                  <div
                    key={dl.id}
                    className="flex items-center justify-between bg-muted border border-border rounded-md p-3"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-mono-sm text-foreground">{dl.id}</span>
                        <span className="text-xs text-muted-foreground">{dl.type}</span>
                      </div>
                      <div className="text-xs text-red-700">{dl.error}</div>
                      <div className="text-xs text-muted-foreground/70">
                        Retries: {dl.retries}/{dl.maxRetries}
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        handleRetryDeadLetter(dl.id)
                      }}
                      className="px-3 py-1 rounded bg-accent/10 text-accent border border-accent/30 text-xs hover:bg-accent/20 transition-colors"
                    >
                      Retry
                    </button>
                  </div>
                ))}
                <div className="flex gap-2 pt-2">
                  <button
                    onClick={handleRetryAll}
                    className="flex-1 px-3 py-2 rounded bg-accent text-white text-body-sm hover:bg-accent-hover transition-all"
                  >
                    Retry All
                  </button>
                  <button
                    onClick={() => {
                      openConfirmModal({
                        title: 'Archive All Dead Letters',
                        message: `Archive ${String(deadLetters.length)} dead letters without retry?`,
                        variant: 'danger',
                        confirmLabel: 'Archive',
                        onConfirm: () => {
                          setDeadLetters([])
                          addToast({
                            title: 'Archived',
                            message: 'All dead letters archived.',
                            type: 'success',
                          })
                        },
                      })
                    }}
                    className="px-3 py-2 rounded bg-muted text-muted-foreground border border-border text-body-sm hover:bg-white transition-all"
                  >
                    Archive All
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center py-6">
                <CheckCircle className="w-10 h-10 text-green-700 mx-auto mb-2" />
                <p className="text-body-sm text-muted-foreground">No dead letters</p>
              </div>
            )}
          </div>
        </div>

        <h3 className="text-lg font-semibold text-foreground mb-4">
          Performance Metrics &mdash; 24 Hours
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white border border-border rounded-lg p-5">
            <div className="text-xs text-muted-foreground uppercase tracking-wider mb-3">
              Firestore Reads/Writes
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={firestoreData}>
                <defs>
                  <linearGradient id="gradR" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#d64933" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#d64933" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradW" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#177245" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#177245" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="hour" stroke="#8a9199" fontSize={10} />
                <YAxis stroke="#8a9199" fontSize={10} />
                <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                <Area
                  type="monotone"
                  dataKey="reads"
                  stroke="#d64933"
                  fill="url(#gradR)"
                  strokeWidth={1.5}
                />
                <Area
                  type="monotone"
                  dataKey="writes"
                  stroke="#177245"
                  fill="url(#gradW)"
                  strokeWidth={1.5}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white border border-border rounded-lg p-5">
            <div className="text-xs text-muted-foreground uppercase tracking-wider mb-3">
              Cloud Function Latency
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={latencyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="hour" stroke="#8a9199" fontSize={10} />
                <YAxis stroke="#8a9199" fontSize={10} />
                <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                <ReferenceLine y={200} stroke="#177245" strokeDasharray="4 4" />
                <Line
                  type="monotone"
                  dataKey="p95"
                  stroke="#d64933"
                  strokeWidth={1.5}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="p99"
                  stroke="#c7761e"
                  strokeWidth={1.5}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white border border-border rounded-lg p-5">
            <div className="text-xs text-muted-foreground uppercase tracking-wider mb-3">
              RTDB Connections
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={rtdbData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="hour" stroke="#8a9199" fontSize={10} />
                <YAxis stroke="#8a9199" fontSize={10} />
                <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                <Bar dataKey="connections" fill="#d64933" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white border border-border rounded-lg p-5 mb-6">
          <div className="text-xs text-muted-foreground uppercase tracking-wider mb-3">
            API Throughput (RPM)
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={throughputData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="hour" stroke="#8a9199" fontSize={10} />
              <YAxis stroke="#8a9199" fontSize={10} />
              <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
              <Bar dataKey="rpm" fill="#7c3aed" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white border border-border rounded-lg p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-foreground">Recent System Events</h3>
            <div className="flex gap-1">
              {(['all', 'info', 'warning', 'critical'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => {
                    setEventFilter(f)
                  }}
                  className={cn(
                    'px-3 py-1 rounded-md text-xs capitalize border transition-all',
                    eventFilter === f
                      ? 'bg-muted text-foreground border-border'
                      : 'bg-transparent text-muted-foreground/70 border-transparent hover:bg-muted',
                  )}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
          <div className="max-h-[300px] overflow-y-auto space-y-2">
            {filteredEvents.map((ev) => (
              <div
                key={ev.id}
                className="flex items-start gap-3 py-2 border-b border-border last:border-0"
              >
                <span
                  className={cn(
                    'w-2 h-2 rounded-full mt-1.5 shrink-0',
                    ev.severity === 'critical'
                      ? 'bg-red-700'
                      : ev.severity === 'warning'
                        ? 'bg-amber-700'
                        : 'bg-green-700',
                  )}
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-muted-foreground/70">
                      {format(parseISO(ev.timestamp), 'HH:mm:ss')}
                    </span>
                    <span className="text-xs text-muted-foreground">{ev.actor}</span>
                  </div>
                  <div className="text-body-sm text-foreground">{ev.action}</div>
                  {ev.target && <div className="text-xs text-accent">{ev.target}</div>}
                </div>
              </div>
            ))}
          </div>
        </div>

        {prewarmOpen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center">
            <div
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (!prewarming && e.key === 'Escape') setPrewarmOpen(false)
              }}
              onClick={() => {
                if (!prewarming) setPrewarmOpen(false)
              }}
            />
            <div className="relative bg-white border border-border rounded-xl max-w-[560px] w-full mx-4 p-5">
              <h3 className="text-lg font-semibold text-foreground mb-2">
                Pre-warm System Resources
              </h3>
              <p className="text-body-sm text-muted-foreground mb-4">
                Pre-allocate Cloud Function instances and warm database connections to handle surge
                traffic. Recommended 30 minutes before anticipated events.
              </p>
              <div className="space-y-3 mb-6">
                {(['light', 'heavy', 'custom'] as const).map((lvl) => (
                  <button
                    key={lvl}
                    onClick={() => {
                      setPrewarmLevel(lvl)
                    }}
                    className={cn(
                      'w-full text-left px-4 py-3 rounded-lg border transition-all',
                      prewarmLevel === lvl
                        ? 'border-accent bg-accent/10'
                        : 'border-border bg-muted hover:border-muted-foreground/30',
                    )}
                  >
                    <div className="text-body-sm text-foreground font-medium capitalize">
                      {lvl} Surge
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {lvl === 'light' && '~2x normal traffic'}
                      {lvl === 'heavy' && '~5x normal traffic'}
                      {lvl === 'custom' && 'Configure manually'}
                    </div>
                  </button>
                ))}
              </div>
              {prewarming && (
                <div className="mb-4">
                  <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                    <span>Warming functions...</span>
                    <span>{prewarmProgress}/24</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-accent"
                      initial={{ width: 0 }}
                      animate={{ width: `${String((prewarmProgress / 24) * 100)}%` }}
                      transition={{ duration: 0.2 }}
                    />
                  </div>
                </div>
              )}
              <div className="flex justify-end gap-3">
                <button
                  disabled={prewarming}
                  onClick={() => {
                    setPrewarmOpen(false)
                  }}
                  className="px-4 py-2 rounded-md border border-border text-body-sm text-foreground hover:bg-muted transition-colors disabled:opacity-40"
                >
                  Cancel
                </button>
                <button
                  disabled={prewarming}
                  onClick={handlePrewarm}
                  className="px-4 py-2 rounded-md bg-accent text-white text-body-sm font-medium hover:bg-accent-hover transition-all disabled:opacity-40 flex items-center gap-2"
                >
                  {prewarming && <RefreshCw className="w-4 h-4 animate-spin" />}
                  Pre-warm Now
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  )
}

function StatusCard({ metric }: { metric: SystemHealthMetric }) {
  const icons: Record<string, React.ReactNode> = {
    Firestore: <Database className="w-5 h-5" />,
    'Realtime Database': <Radio className="w-5 h-5" />,
    'Cloud Functions': <Cloud className="w-5 h-5" />,
    'SMS Gateway': <MessageSquare className="w-5 h-5" />,
    'FCM Push': <Bell className="w-5 h-5" />,
  }

  const statusColor =
    metric.status === 'HEALTHY'
      ? 'text-green-700'
      : metric.status === 'DEGRADED'
        ? 'text-amber-700'
        : 'text-red-700'
  const borderColor =
    metric.status === 'HEALTHY'
      ? 'border-border'
      : metric.status === 'DEGRADED'
        ? 'border-amber-300'
        : 'border-red-300'
  const statusDot =
    metric.status === 'HEALTHY'
      ? 'bg-green-700'
      : metric.status === 'DEGRADED'
        ? 'bg-amber-700'
        : 'bg-red-700'
  const pulse = metric.status === 'DOWN'

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn('metric-card border', borderColor)}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="text-xs text-muted-foreground uppercase tracking-wider">
          {metric.service}
        </div>
        <div className="text-muted-foreground">
          {icons[metric.service] ?? <Activity className="w-5 h-5" />}
        </div>
      </div>
      <div className="flex items-center gap-2 mb-2">
        <span
          className={cn('w-2.5 h-2.5 rounded-full', statusDot, pulse && 'animate-pulse-soft')}
        />
        <span className={cn('text-body-sm font-medium', statusColor)}>
          {metric.status === 'HEALTHY'
            ? 'Operational'
            : metric.status === 'DEGRADED'
              ? 'Degraded'
              : 'Critical'}
        </span>
      </div>
      <div className="font-mono text-mono-sm text-muted-foreground mb-1">
        {metric.latency}ms avg
      </div>
      <div className="text-body-sm text-muted-foreground mb-2">Uptime {metric.uptime}%</div>
      {metric.queueDepth !== undefined && (
        <div className="text-xs text-muted-foreground/70 mb-2">Queue: {metric.queueDepth}</div>
      )}
    </motion.div>
  )
}

function QueueBar({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = Math.min(100, (value / max) * 100)
  const color =
    value < max * 0.3 ? 'bg-green-700' : value < max * 0.7 ? 'bg-amber-700' : 'bg-red-700'
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span
          className={cn(
            'font-mono text-mono-sm',
            value > max * 0.7 ? 'text-red-700' : 'text-foreground',
          )}
        >
          {value}
        </span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all', color)}
          style={{ width: `${String(pct)}%` }}
        />
      </div>
    </div>
  )
}
