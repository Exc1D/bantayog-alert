import { useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  FileText,
  BarChart,
  Users,
  ArrowUpRight,
  ClipboardList,
  Activity,
  Globe,
  Zap,
  Download,
  Mail,
  Calendar,
  XCircle,
  ChevronRight,
  ChevronLeft,
  Play,
  Pencil,
  Trash,
  Plus,
} from 'lucide-react'
import { format } from 'date-fns'
import { useDataStore } from '@/stores/dataStore'
import { useUIStore } from '@/stores/uiStore'
import { AppShell } from '@/components/layout/AppShell'
import { cn } from '@/lib/utils'

const templates = [
  {
    id: 'incident-24h',
    name: 'Incident Summary — Last 24h',
    icon: <FileText className="w-5 h-5" />,
    desc: 'All incidents reported in the last 24 hours with severity breakdown',
    lastGen: '2h ago',
  },
  {
    id: 'incident-7d',
    name: 'Incident Summary — Last 7 Days',
    icon: <FileText className="w-5 h-5" />,
    desc: 'Weekly incident summary with trends and analysis',
    lastGen: '1d ago',
  },
  {
    id: 'municipal',
    name: 'Municipal Performance Report',
    icon: <BarChart className="w-5 h-5" />,
    desc: 'Performance metrics across all 12 municipalities',
    lastGen: '3d ago',
  },
  {
    id: 'responder',
    name: 'Responder Activity Report',
    icon: <Users className="w-5 h-5" />,
    desc: 'Responder utilization and response time analysis',
    lastGen: '5d ago',
  },
  {
    id: 'ndrrmc',
    name: 'NDRRMC Escalation Summary',
    icon: <ArrowUpRight className="w-5 h-5" />,
    desc: 'All escalations and their resolution status',
    lastGen: '1w ago',
  },
  {
    id: 'audit',
    name: 'Audit Log Summary',
    icon: <ClipboardList className="w-5 h-5" />,
    desc: 'Key audit events and private data access summary',
    lastGen: '2w ago',
  },
  {
    id: 'health',
    name: 'System Health Report',
    icon: <Activity className="w-5 h-5" />,
    desc: 'Infrastructure health and performance metrics',
    lastGen: '3d ago',
  },
  {
    id: 'sitrep',
    name: 'Full Province SITREP',
    icon: <Globe className="w-5 h-5" />,
    desc: 'Comprehensive situation report for NDRRMC',
    lastGen: 'Never',
  },
]

const municipalityNames = [
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
]

type ReportFormat = 'PDF' | 'CSV' | 'JSON'
type StepKey = 1 | 2 | 3 | 4

interface ScheduledReport {
  id: string
  name: string
  schedule: string
  format: ReportFormat
  recipients: string
  enabled: boolean
}

interface RecentExport {
  id: string
  name: string
  date: string
  format: ReportFormat
}

export default function ReportsPage() {
  const { municipalities: dataMunicipalities } = useDataStore()
  const { addToast } = useUIStore()

  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const [preview, setPreview] = useState(false)
  const [reportFormat, setReportFormat] = useState<ReportFormat>('PDF')
  const [builderOpen, setBuilderOpen] = useState(false)
  const [builderStep, setBuilderStep] = useState<StepKey>(1)
  const [scheduledOpen, setScheduledOpen] = useState(false)

  const [scheduledReports, setScheduledReports] = useState<ScheduledReport[]>([
    {
      id: 'sch-1',
      name: 'Daily Incident Summary',
      schedule: 'Every day at 06:00',
      format: 'PDF',
      recipients: 'pdrrmo@camnorte.gov.ph',
      enabled: true,
    },
    {
      id: 'sch-2',
      name: 'Weekly Performance',
      schedule: 'Mondays 08:00',
      format: 'CSV',
      recipients: 'ops@camnorte.gov.ph',
      enabled: true,
    },
    {
      id: 'sch-3',
      name: 'Monthly NDRRMC Report',
      schedule: '1st of month',
      format: 'PDF',
      recipients: 'ndrrmc@ops.gov.ph',
      enabled: false,
    },
  ])

  const [recentExports] = useState<RecentExport[]>([
    {
      id: 'exp-1',
      name: 'Incident Summary — Last 24h',
      date: '2024-11-15T14:35:00Z',
      format: 'PDF',
    },
    {
      id: 'exp-2',
      name: 'Municipal Performance Report',
      date: '2024-11-14T09:00:00Z',
      format: 'CSV',
    },
    { id: 'exp-3', name: 'NDRRMC Escalation Summary', date: '2024-11-13T16:00:00Z', format: 'PDF' },
  ])

  const [selectedSources, setSelectedSources] = useState<string[]>(['incidents'])
  const [dateFrom, setDateFrom] = useState('2024-11-01')
  const [dateTo, setDateTo] = useState('2024-11-15')
  const [selectedMunicipalities, setSelectedMunicipalities] = useState<string[]>(municipalityNames)
  const [includeCharts, setIncludeCharts] = useState(true)
  const [includeTables, setIncludeTables] = useState(true)

  const handleGenerate = useCallback(() => {
    setGenerating(true)
    setPreview(false)
    setTimeout(() => {
      setGenerating(false)
      setPreview(true)
      addToast({
        title: 'Report Generated',
        message: 'Your report is ready for preview.',
        type: 'success',
      })
    }, 2500)
  }, [addToast])

  const handleDownload = useCallback(() => {
    addToast({
      title: 'Download Started',
      message: `${reportFormat} download initiated.`,
      type: 'success',
    })
  }, [addToast, reportFormat])

  const toggleSchedule = useCallback((id: string) => {
    setScheduledReports((prev) =>
      prev.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s)),
    )
  }, [])

  const deleteSchedule = useCallback(
    (id: string) => {
      setScheduledReports((prev) => prev.filter((s) => s.id !== id))
      addToast({ title: 'Deleted', message: 'Scheduled report removed.', type: 'info' })
    },
    [addToast],
  )

  return (
    <AppShell>
      <div className="p-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Reports & Analytics Export</h1>
            <p className="text-body-sm text-muted-foreground mt-1">
              Generate, schedule, and export province-wide reports
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setSelectedTemplate('incident-24h')
                handleGenerate()
              }}
              className="flex items-center gap-2 px-4 py-2 rounded-md bg-accent text-white hover:bg-accent-hover transition-all text-body-sm font-medium"
            >
              <Zap className="w-4 h-4" /> Quick Generate
            </button>
            <button
              onClick={() => {
                setScheduledOpen(true)
              }}
              className="flex items-center gap-2 px-4 py-2 rounded-md bg-white text-foreground border border-border hover:bg-muted transition-all text-body-sm"
            >
              <Calendar className="w-4 h-4" /> Scheduled Reports
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-white border border-border rounded-lg p-4">
              <h3 className="text-lg font-semibold text-foreground mb-3">Quick Reports</h3>
              <div className="space-y-2">
                {templates.map((t) => (
                  <div
                    key={t.id}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') setSelectedTemplate(t.id)
                    }}
                    onClick={() => {
                      setSelectedTemplate(t.id)
                    }}
                    className={cn(
                      'flex items-start gap-3 p-3 rounded-lg border transition-all cursor-pointer',
                      selectedTemplate === t.id
                        ? 'border-accent bg-accent/5'
                        : 'border-border bg-muted hover:border-muted-foreground/30',
                    )}
                  >
                    <div
                      className={cn(
                        'text-muted-foreground mt-0.5',
                        selectedTemplate === t.id && 'text-accent',
                      )}
                    >
                      {t.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-body-sm text-foreground font-medium truncate">
                        {t.name}
                      </div>
                      <div className="text-xs text-muted-foreground/70 truncate">{t.desc}</div>
                      <div className="text-xs text-muted-foreground/70 mt-0.5">
                        Last: {t.lastGen}
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setSelectedTemplate(t.id)
                        handleGenerate()
                      }}
                      className="px-3 py-1 rounded bg-accent/15 text-accent border border-accent text-xs hover:bg-accent/25 transition-colors shrink-0"
                    >
                      Generate
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white border border-border rounded-lg p-4">
              <h3 className="text-lg font-semibold text-foreground mb-3">Custom Report</h3>
              <button
                onClick={() => {
                  setBuilderOpen(true)
                  setBuilderStep(1)
                }}
                className="w-full px-4 py-3 rounded-md bg-muted text-foreground border border-border hover:bg-white transition-all text-body-sm inline-flex items-center justify-center gap-2"
              >
                Build Custom Report <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-white border border-border rounded-lg p-4">
              <h3 className="text-lg font-semibold text-foreground mb-3">Recent Exports</h3>
              <div className="space-y-2">
                {recentExports.map((exp) => (
                  <div
                    key={exp.id}
                    className="flex items-center justify-between py-2 border-b border-border last:border-0"
                  >
                    <div>
                      <div className="text-body-sm text-foreground">{exp.name}</div>
                      <div className="text-xs text-muted-foreground/70">
                        {format(new Date(exp.date), 'MMM d, HH:mm')}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border',
                          exp.format === 'PDF'
                            ? 'bg-red-50 text-red-700 border-red-200'
                            : 'bg-green-50 text-green-700 border-green-200',
                        )}
                      >
                        {exp.format}
                      </span>
                      <button
                        onClick={() => {
                          addToast({
                            title: 'Download',
                            message: `Downloading ${exp.name}...`,
                            type: 'info',
                          })
                        }}
                        className="text-accent text-xs hover:underline"
                      >
                        Download
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="lg:col-span-3">
            <div className="bg-white border border-border rounded-lg min-h-[500px]">
              {!preview && !generating && (
                <div className="flex flex-col items-center justify-center h-[500px] p-8 text-center">
                  <FileText className="w-16 h-16 text-muted-foreground/40 mb-4" />
                  <p className="text-body-md text-muted-foreground mb-2">
                    Select a report template or build a custom report
                  </p>
                  <p className="text-body-sm text-accent">
                    Tip: &ldquo;Full Province SITREP&rdquo; includes all sections needed for NDRRMC
                    reporting
                  </p>
                </div>
              )}

              {generating && (
                <div className="flex flex-col items-center justify-center h-[500px]">
                  <div className="w-12 h-12 border-2 border-accent border-t-transparent rounded-full animate-spin mb-4" />
                  <p className="text-body-md text-foreground">Generating report...</p>
                  <p className="text-body-sm text-muted-foreground mt-1">
                    Compiling data and rendering charts
                  </p>
                </div>
              )}

              {preview && selectedTemplate && (
                <div>
                  <div className="p-5 border-b border-border">
                    <div className="flex items-start justify-between">
                      <div>
                        <h2 className="text-lg font-semibold text-foreground">
                          {templates.find((t) => t.id === selectedTemplate)?.name ??
                            'Custom Report'}
                        </h2>
                        <div className="text-xs text-muted-foreground/70 mt-1">
                          Generated: {format(new Date(), 'MMM d, yyyy, HH:mm:ss')} by Juan Dela Cruz
                        </div>
                        <div className="text-xs text-muted-foreground/70">
                          Data: Nov 1, 2024 — Nov 15, 2024
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          setPreview(false)
                        }}
                        className="text-muted-foreground/70 hover:text-foreground transition-colors"
                      >
                        <XCircle className="w-5 h-5" />
                      </button>
                    </div>
                  </div>

                  <div className="p-5 space-y-6 max-h-[500px] overflow-y-auto">
                    <div>
                      <h3 className="text-lg font-semibold text-foreground mb-2">
                        Executive Summary
                      </h3>
                      <p className="text-body-sm text-foreground">
                        47 active incidents province-wide (12 HIGH, 20 MEDIUM, 15 LOW). 8
                        municipalities affected out of 12. 128 responders active, avg response time
                        14:32.
                      </p>
                    </div>

                    <div>
                      <h3 className="text-lg font-semibold text-foreground mb-2">
                        Severity Breakdown
                      </h3>
                      <div className="grid grid-cols-3 gap-3">
                        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-center">
                          <div className="text-display-md font-mono text-red-700">12</div>
                          <div className="text-xs text-muted-foreground">HIGH</div>
                        </div>
                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-center">
                          <div className="text-display-md font-mono text-amber-700">20</div>
                          <div className="text-xs text-muted-foreground">MEDIUM</div>
                        </div>
                        <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
                          <div className="text-display-md font-mono text-green-700">15</div>
                          <div className="text-xs text-muted-foreground">LOW</div>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h3 className="text-lg font-semibold text-foreground mb-2">
                        Municipal Summary
                      </h3>
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="data-table-header text-left">
                              <th className="py-2 px-3">Municipality</th>
                              <th className="py-2 px-3 text-right">Active</th>
                              <th className="py-2 px-3 text-right">Responders</th>
                              <th className="py-2 px-3 text-right">Avg Time</th>
                            </tr>
                          </thead>
                          <tbody>
                            {dataMunicipalities.slice(0, 5).map((m) => (
                              <tr key={m.id} className="data-table-row">
                                <td className="py-2 px-3 text-body-sm text-foreground">{m.name}</td>
                                <td className="py-2 px-3 text-right font-mono text-mono-sm text-foreground">
                                  {m.activeIncidents}
                                </td>
                                <td className="py-2 px-3 text-right font-mono text-mono-sm text-foreground">
                                  {m.activeResponders}
                                </td>
                                <td className="py-2 px-3 text-right font-mono text-mono-sm text-foreground">
                                  {m.avgResponseTime}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <div className="border-t border-border pt-4">
                      <p className="text-xs text-muted-foreground/70">
                        Report generated by Bantayog Alert v2.1.4 &middot; PDRRMO Camarines Norte
                      </p>
                      <p className="text-xs text-muted-foreground/70 mt-1">
                        This report is confidential — authorized distribution only
                      </p>
                    </div>
                  </div>

                  <div className="border-t border-border p-5 bg-muted">
                    <h3 className="text-lg font-semibold text-foreground mb-3">Export Options</h3>
                    <div className="grid grid-cols-3 gap-3 mb-4">
                      {(['PDF', 'CSV', 'JSON'] as ReportFormat[]).map((f) => (
                        <button
                          key={f}
                          onClick={() => {
                            setReportFormat(f)
                          }}
                          className={cn(
                            'p-3 rounded-lg border text-left transition-all',
                            reportFormat === f
                              ? 'border-accent bg-accent/10'
                              : 'border-border bg-white hover:border-muted-foreground/30',
                          )}
                        >
                          <div className="text-body-sm text-foreground font-medium">{f}</div>
                          <div className="text-xs text-muted-foreground/70">
                            {f === 'PDF' && 'Formatted document with charts'}
                            {f === 'CSV' && 'Raw data for spreadsheets'}
                            {f === 'JSON' && 'Machine-readable for APIs'}
                          </div>
                        </button>
                      ))}
                    </div>
                    <div className="flex gap-3">
                      <button
                        onClick={handleDownload}
                        className="px-4 py-2 rounded-md bg-accent text-white text-body-sm font-medium hover:bg-accent-hover transition-all inline-flex items-center gap-2"
                      >
                        <Download className="w-4 h-4" /> Download {reportFormat}
                      </button>
                      <button
                        onClick={() => {
                          addToast({
                            title: 'Email',
                            message: 'Report queued for email delivery.',
                            type: 'info',
                          })
                        }}
                        className="px-4 py-2 rounded-md bg-white text-foreground border border-border text-body-sm hover:bg-muted transition-all inline-flex items-center gap-2"
                      >
                        <Mail className="w-4 h-4" /> Email
                      </button>
                      <button
                        onClick={() => {
                          addToast({
                            title: 'NDRRMC',
                            message: 'Report sent to NDRRMC.',
                            type: 'success',
                          })
                        }}
                        className="px-4 py-2 rounded-md bg-white text-foreground border border-border text-body-sm hover:bg-muted transition-all inline-flex items-center gap-2"
                      >
                        <Globe className="w-4 h-4" /> Send to NDRRMC
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {builderOpen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center">
            <div
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (!generating && e.key === 'Escape') setBuilderOpen(false)
              }}
              onClick={() => {
                if (!generating) setBuilderOpen(false)
              }}
            />
            <div className="relative bg-white border border-border rounded-xl max-w-[720px] w-full mx-4 p-5 max-h-[80vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-foreground">Build Custom Report</h3>
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4].map((s) => (
                    <div
                      key={s}
                      className={cn(
                        'w-8 h-1 rounded-full',
                        builderStep >= s ? 'bg-accent' : 'bg-muted',
                      )}
                    />
                  ))}
                </div>
              </div>

              {builderStep === 1 && (
                <div className="space-y-3">
                  <h4 className="text-lg font-semibold text-foreground mb-2">
                    Step 1: Select Data Sources
                  </h4>
                  {[
                    { key: 'incidents', label: 'Incidents (all fields)' },
                    { key: 'responders', label: 'Responders' },
                    { key: 'municipalities', label: 'Municipalities' },
                    { key: 'ndrrmc', label: 'NDRRMC Escalations' },
                    { key: 'audit', label: 'Audit Log (summary)' },
                    { key: 'system', label: 'System Health' },
                    { key: 'sms', label: 'SMS Log' },
                    { key: 'users', label: 'Users' },
                  ].map((src) => (
                    <label key={src.key} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedSources.includes(src.key)}
                        onChange={(e) => {
                          setSelectedSources((prev) =>
                            e.target.checked
                              ? [...prev, src.key]
                              : prev.filter((s) => s !== src.key),
                          )
                        }}
                        className="accent-[#d64933] w-4 h-4"
                      />
                      <span className="text-body-sm text-foreground">{src.label}</span>
                    </label>
                  ))}
                </div>
              )}

              {builderStep === 2 && (
                <div className="space-y-4">
                  <h4 className="text-lg font-semibold text-foreground mb-2">
                    Step 2: Configure Filters
                  </h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <span className="text-xs text-muted-foreground block mb-1">From</span>
                      <input
                        type="date"
                        value={dateFrom}
                        onChange={(e) => {
                          setDateFrom(e.target.value)
                        }}
                        className="w-full bg-white border border-border rounded-md px-3 py-2 text-body-sm text-foreground focus:border-accent focus:outline-none"
                      />
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground block mb-1">To</span>
                      <input
                        type="date"
                        value={dateTo}
                        onChange={(e) => {
                          setDateTo(e.target.value)
                        }}
                        className="w-full bg-white border border-border rounded-md px-3 py-2 text-body-sm text-foreground focus:border-accent focus:outline-none"
                      />
                    </div>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground block mb-2">Municipalities</span>
                    <div className="grid grid-cols-3 gap-2">
                      {municipalityNames.map((m) => (
                        <label key={m} className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selectedMunicipalities.includes(m)}
                            onChange={(e) => {
                              setSelectedMunicipalities((prev) =>
                                e.target.checked ? [...prev, m] : prev.filter((x) => x !== m),
                              )
                            }}
                            className="accent-[#d64933] w-3 h-3"
                          />
                          <span className="text-xs text-foreground">{m}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {builderStep === 3 && (
                <div className="space-y-4">
                  <h4 className="text-lg font-semibold text-foreground mb-2">
                    Step 3: Select Output
                  </h4>
                  <div className="space-y-3">
                    <div>
                      <span className="text-xs text-muted-foreground block mb-2">Format</span>
                      <div className="flex gap-2">
                        {(['PDF', 'CSV', 'JSON'] as ReportFormat[]).map((f) => (
                          <button
                            key={f}
                            onClick={() => {
                              setReportFormat(f)
                            }}
                            className={cn(
                              'px-4 py-2 rounded-md text-body-sm border transition-all',
                              reportFormat === f
                                ? 'bg-muted text-foreground border-accent'
                                : 'border-border text-muted-foreground hover:border-muted-foreground/30',
                            )}
                          >
                            {f}
                          </button>
                        ))}
                      </div>
                    </div>
                    <Toggle
                      label="Include charts"
                      enabled={includeCharts}
                      onToggle={() => {
                        setIncludeCharts((v) => !v)
                      }}
                    />
                    <Toggle
                      label="Include raw data tables"
                      enabled={includeTables}
                      onToggle={() => {
                        setIncludeTables((v) => !v)
                      }}
                    />
                  </div>
                </div>
              )}

              {builderStep === 4 && (
                <div className="space-y-4">
                  <h4 className="text-lg font-semibold text-foreground mb-2">
                    Step 4: Review & Generate
                  </h4>
                  <div className="bg-muted border border-border rounded-lg p-4 space-y-2">
                    <p className="text-body-sm text-foreground">
                      Report will include: <strong>{selectedSources.join(', ')}</strong> from{' '}
                      {dateFrom} to {dateTo}
                    </p>
                    <p className="text-body-sm text-foreground">
                      Municipalities:{' '}
                      <strong>
                        {selectedMunicipalities.length === municipalityNames.length
                          ? 'All 12'
                          : selectedMunicipalities.join(', ')}
                      </strong>
                    </p>
                    <p className="text-body-sm text-foreground">
                      Format: <strong>{reportFormat}</strong> with{' '}
                      {includeCharts ? 'charts' : 'no charts'} and{' '}
                      {includeTables ? 'tables' : 'no tables'}
                    </p>
                    <p className="text-xs text-muted-foreground/70 mt-2">Estimated size: ~245 KB</p>
                  </div>
                </div>
              )}

              <div className="flex justify-between mt-6">
                <button
                  disabled={builderStep === 1}
                  onClick={() => {
                    setBuilderStep((s) => (s > 1 ? ((s - 1) as StepKey) : s))
                  }}
                  className="px-4 py-2 rounded-md border border-border text-body-sm text-foreground hover:bg-muted transition-colors disabled:opacity-30"
                >
                  <ChevronLeft className="w-4 h-4 inline mr-1" /> Back
                </button>
                {builderStep < 4 ? (
                  <button
                    onClick={() => {
                      setBuilderStep((s) => (s < 4 ? ((s + 1) as StepKey) : s))
                    }}
                    className="px-4 py-2 rounded-md bg-accent text-white text-body-sm font-medium hover:bg-accent-hover transition-all"
                  >
                    Next <ChevronRight className="w-4 h-4 inline ml-1" />
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      setBuilderOpen(false)
                      handleGenerate()
                    }}
                    className="px-4 py-2 rounded-md bg-accent text-white text-body-sm font-medium hover:bg-accent-hover transition-all inline-flex items-center gap-2"
                  >
                    <Zap className="w-4 h-4" /> Generate Report
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {scheduledOpen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-end">
            <div
              className="absolute inset-0 bg-black/50"
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Escape') setScheduledOpen(false)
              }}
              onClick={() => {
                setScheduledOpen(false)
              }}
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{
                duration: 0.3,
                ease: [0.16, 1, 0.3, 1] as [number, number, number, number],
              }}
              className="relative bg-white border-l border-border w-full max-w-[480px] h-full overflow-y-auto"
            >
              <div className="sticky top-0 bg-muted border-b border-border p-4 flex items-center justify-between z-10">
                <h2 className="text-lg font-semibold text-foreground">Scheduled Reports</h2>
                <button
                  onClick={() => {
                    setScheduledOpen(false)
                  }}
                  className="text-muted-foreground/70 hover:text-foreground transition-colors"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>
              <div className="p-5 space-y-3">
                {scheduledReports.map((sch) => (
                  <div key={sch.id} className="bg-muted border border-border rounded-lg p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="text-body-sm text-foreground font-medium">{sch.name}</div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => {
                            toggleSchedule(sch.id)
                          }}
                          className={cn(
                            'w-8 h-4 rounded-full relative transition-colors',
                            sch.enabled ? 'bg-accent' : 'bg-muted border border-border',
                          )}
                        >
                          <span
                            className={cn(
                              'absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform',
                              sch.enabled ? 'translate-x-4' : 'translate-x-0.5',
                            )}
                          />
                        </button>
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground">{sch.schedule}</div>
                    <div className="flex items-center gap-2 mt-2">
                      <span
                        className={cn(
                          'inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border',
                          sch.format === 'PDF'
                            ? 'bg-red-50 text-red-700 border-red-200'
                            : 'bg-green-50 text-green-700 border-green-200',
                        )}
                      >
                        {sch.format}
                      </span>
                      <span className="text-xs text-muted-foreground/70 truncate">
                        {sch.recipients}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-3">
                      <button
                        onClick={() => {
                          addToast({
                            title: 'Running...',
                            message: `Scheduled report "${sch.name}" running now.`,
                            type: 'info',
                          })
                        }}
                        className="px-2 py-1 rounded bg-accent/15 text-accent border border-accent text-xs hover:bg-accent/25 transition-colors inline-flex items-center gap-1"
                      >
                        <Play className="w-3 h-3" /> Run now
                      </button>
                      <button className="p-1 text-muted-foreground hover:text-foreground transition-colors">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          deleteSchedule(sch.id)
                        }}
                        className="p-1 text-muted-foreground hover:text-red-700 transition-colors"
                      >
                        <Trash className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
                <button
                  onClick={() => {
                    const id = `sch-${String(Date.now())}`
                    setScheduledReports((prev) => [
                      ...prev,
                      {
                        id,
                        name: 'New Scheduled Report',
                        schedule: 'Daily at 08:00',
                        format: 'PDF',
                        recipients: 'pdrrmo@camnorte.gov.ph',
                        enabled: true,
                      },
                    ])
                    addToast({
                      title: 'Added',
                      message: 'New scheduled report created.',
                      type: 'success',
                    })
                  }}
                  className="w-full px-4 py-3 rounded-lg bg-accent text-white text-body-sm font-medium hover:bg-accent-hover transition-all inline-flex items-center justify-center gap-2"
                >
                  <Plus className="w-4 h-4" /> Add Scheduled Report
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </div>
    </AppShell>
  )
}

function Toggle({
  label,
  enabled,
  onToggle,
}: {
  label: string
  enabled: boolean
  onToggle: () => void
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-body-sm text-foreground">{label}</span>
      <button
        onClick={onToggle}
        className={cn(
          'w-10 h-5 rounded-full transition-colors relative',
          enabled ? 'bg-accent' : 'bg-muted',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform',
            enabled ? 'translate-x-5' : 'translate-x-0.5',
          )}
        />
      </button>
    </div>
  )
}
