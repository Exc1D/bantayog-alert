import { useParams, useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  CheckCircle,
  XCircle,
  Eye,
  Zap,
  RefreshCw,
  PhoneCall,
  ArrowLeft,
  Home,
} from 'lucide-react'
import { useReport } from '../hooks/useReport.js'
import { StatusBanner } from './ui/StatusBanner.js'
import { Button } from './ui/Button.js'
import { Timeline } from './ui/Timeline.js'
import { RadarRings } from './ui/RadarRings.js'

const RESPONDER_PHONE_NUMBER = '0547211216'

const TERMINAL_STATUSES = new Set([
  'resolved',
  'closed',
  'rejected',
  'cancelled',
  'cancelled_false_report',
  'merged_as_duplicate',
])

function heroConfig(status: string): {
  bg: string
  color: string
  text: string
  icon: React.ReactNode
} {
  switch (status) {
    case 'new':
    case 'awaiting_verify':
      return {
        bg: 'bg-brand-500',
        color: '#0F9488',
        text: "Your report is in the queue. We've got it.",
        icon: <Eye size={24} className="text-white" />,
      }
    case 'verified':
    case 'assigned':
    case 'acknowledged':
      return {
        bg: 'bg-warning-500',
        color: '#D97706',
        text: 'Responders have been notified.',
        icon: <Zap size={24} className="text-white" />,
      }
    case 'en_route':
    case 'on_scene':
      return {
        bg: 'bg-warning-600',
        color: '#B45309',
        text: 'Help is on the way.',
        icon: <Zap size={24} className="text-white" />,
      }
    case 'reopened':
      return {
        bg: 'bg-warning-500',
        color: '#D97706',
        text: 'Report re-opened. Responders will be re-assigned.',
        icon: <Zap size={24} className="text-white" />,
      }
    case 'resolved':
    case 'closed':
      return {
        bg: 'bg-success-500',
        color: '#059669',
        text: 'Situation resolved. Thank you.',
        icon: <CheckCircle size={24} className="text-white" />,
      }
    case 'cancelled':
      return {
        bg: 'bg-surface-600',
        color: '#4F5859',
        text: 'This report was cancelled.',
        icon: <XCircle size={24} className="text-white" />,
      }
    case 'cancelled_false_report':
      return {
        bg: 'bg-surface-600',
        color: '#4F5859',
        text: 'This report was closed after review.',
        icon: <XCircle size={24} className="text-white" />,
      }
    case 'merged_as_duplicate':
      return {
        bg: 'bg-surface-600',
        color: '#4F5859',
        text: 'This report was merged into another incident.',
        icon: <RefreshCw size={24} className="text-white" />,
      }
    default:
      return {
        bg: 'bg-surface-600',
        color: '#4F5859',
        text: 'This report was not accepted for review.',
        icon: <XCircle size={24} className="text-white" />,
      }
  }
}

const TIMELINE_LABELS: Record<string, string> = {
  new: 'Report received',
  awaiting_verify: 'Under review by MDRRMO',
  verified: 'Verified — responders notified',
  assigned: 'Responder assigned',
  acknowledged: 'Responder acknowledged',
  en_route: 'Responder en route',
  on_scene: 'Responder on scene',
  reopened: 'Report reopened',
  resolved: 'Situation resolved',
  closed: 'Report closed',
  rejected: 'Report rejected',
  cancelled: 'Report cancelled',
  cancelled_false_report: 'Report cancelled',
  merged_as_duplicate: 'Merged as duplicate',
}

export function TrackingScreen() {
  const navigate = useNavigate()
  const { reference } = useParams<{ reference: string }>()
  const { data: report, isPending, error } = useReport(reference ?? '')

  const header = (
    <div className="sticky top-0 z-nav bg-surface-100/90 backdrop-blur-md border-b border-surface-200 px-4 py-3 flex items-center gap-3">
      <button
        type="button"
        onClick={() => void navigate(-1)}
        aria-label="Go back"
        className="w-11 h-11 flex items-center justify-center rounded-full active:bg-surface-200 transition-colors"
      >
        <ArrowLeft size={24} className="text-surface-700" />
      </button>
      <h1 className="text-lg font-semibold text-surface-900 flex-1">Report Status</h1>
      <button
        type="button"
        onClick={() => void navigate('/')}
        aria-label="Go to home"
        className="w-11 h-11 flex items-center justify-center rounded-full active:bg-surface-200 transition-colors"
      >
        <Home size={20} className="text-surface-700" />
      </button>
    </div>
  )

  if (!reference) {
    return (
      <div className="min-h-[100dvh] bg-surface-100 flex flex-col">
        {header}
        <div className="page-container">
          <StatusBanner variant="failed" icon={<AlertTriangle size={16} />}>
            Invalid tracking link
          </StatusBanner>
        </div>
      </div>
    )
  }

  if (isPending) {
    return (
      <div className="min-h-[100dvh] bg-surface-100 flex flex-col">
        {header}
        <div className="page-container flex items-center justify-center py-16">
          <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    )
  }

  if (error || !report) {
    return (
      <div className="min-h-[100dvh] bg-surface-100 flex flex-col">
        {header}
        <div className="page-container">
          <StatusBanner variant="queued" icon={<RefreshCw size={16} className="animate-spin" />}>
            Your report is being processed — this page updates automatically.
          </StatusBanner>
        </div>
      </div>
    )
  }

  const hero = heroConfig(report.status)
  const isTerminal = TERMINAL_STATUSES.has(report.status)

  const timelineEvents = [
    ...report.timeline.map((e) => ({
      label: TIMELINE_LABELS[e.event] ?? e.event,
      meta: `${e.actor ?? 'system'} · ${new Date(e.timestamp).toLocaleString()}`,
      state: 'complete' as const,
    })),
    ...(!isTerminal ? [{ label: 'Awaiting resolution', meta: '', state: 'pending' as const }] : []),
  ]

  return (
    <div className="min-h-[100dvh] bg-surface-100 flex flex-col">
      {header}

      {/* Status hero banner */}
      <div
        className={`relative flex flex-col items-center justify-center py-8 px-4 text-center ${hero.bg}`}
      >
        <div className="relative flex items-center justify-center mb-3">
          {!isTerminal && <RadarRings color={hero.color} />}
          <div className="relative z-10 w-16 h-16 rounded-full bg-white/20 flex items-center justify-center">
            {hero.icon}
          </div>
        </div>
        <p className="text-white font-bold text-lg leading-snug max-w-xs">{hero.text}</p>
      </div>

      <div className="page-container">
        <h2 className="tracking-header tracking-ref">{reference.toUpperCase()}</h2>
        <p className="tracking-meta">
          Reported {report.createdAt ? new Date(report.createdAt).toLocaleString() : 'Loading...'} ·{' '}
          {report.reportType}
        </p>

        <div className="card tracking-section">
          <h3 className="card-header">Location</h3>
          <div className="card-row">
            <span className="card-label">Address</span>
            <span className="card-value">{report.location?.address ?? 'N/A'}</span>
          </div>
          <div className="card-row">
            <span className="card-label">Coords</span>
            <span className="card-value">
              {report.location?.lat?.toFixed(5)}, {report.location?.lng?.toFixed(5)}
            </span>
          </div>
        </div>

        <div className="card tracking-section">
          <h3 className="card-header">Your contact</h3>
          <div className="card-row">
            <span className="card-label">Name</span>
            <span className="card-value">{report.reporterName}</span>
          </div>
          <div className="card-row">
            <span className="card-label">Phone</span>
            <span className="card-value">
              {report.reporterPhone && report.reporterPhone.length >= 4
                ? `****-***-${report.reporterPhone.slice(-4)}`
                : 'N/A'}
            </span>
          </div>
        </div>

        {report.resolutionNote ? (
          <div className="card tracking-section">
            <h3 className="card-header">Resolution</h3>
            <div className="card-label mb-1">{report.resolutionNote}</div>
            <div className="card-row">
              <span className="card-label">Closed by</span>
              <span className="card-value">{report.closedBy}</span>
            </div>
          </div>
        ) : null}

        {timelineEvents.length === 0 ? (
          <div className="tracking-empty">No updates yet</div>
        ) : (
          <Timeline events={timelineEvents} />
        )}

        <div className="tracking-actions">
          <Button variant="secondary" fullWidth>
            <RefreshCw size={14} style={{ marginRight: '4px' }} />
            Update report
          </Button>
          <a
            href={`tel:${RESPONDER_PHONE_NUMBER}`}
            className="btn btn--primary btn--full"
            style={{
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <PhoneCall size={14} style={{ marginRight: '4px' }} />
            Call responders
          </a>
        </div>

        {report.status === 'resolved' ? (
          <Button variant="secondary" fullWidth className="mt-2">
            Re-open if situation changed
          </Button>
        ) : null}
      </div>
    </div>
  )
}
