import { useParams } from 'react-router-dom'
import {
  Phone,
  User,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Eye,
  Zap,
  RefreshCw,
  PhoneCall,
} from 'lucide-react'
import { useReport } from '../hooks/useReport'
import { StatusBanner } from './ui/StatusBanner'
import { Button } from './ui/Button'
import { Timeline } from './ui/Timeline'

const RESPONDER_PHONE_NUMBER = '0547211216'

export function TrackingScreen() {
  const { reference } = useParams<{ reference: string }>()
  const { data: report, isLoading, error } = useReport(reference ?? '')

  if (!reference) {
    return (
      <div className="page-container">
        <StatusBanner variant="failed" icon={<AlertTriangle size={16} />}>
          Invalid tracking link
        </StatusBanner>
      </div>
    )
  }

  if (isLoading) {
    return <div className="page-container">Loading...</div>
  }

  if (error || !report) {
    return (
      <div className="page-container">
        <StatusBanner variant="failed" icon={<AlertTriangle size={16} />}>
          Report not found
        </StatusBanner>
      </div>
    )
  }

  const statusVariant =
    report.status === 'verified' || report.status === 'resolved'
      ? 'success'
      : report.status === 'rejected'
        ? 'failed'
        : 'queued'

  const statusConfig = {
    verified: { icon: <Zap size={16} />, text: 'Responders dispatched.' },
    resolved: { icon: <CheckCircle size={16} />, text: 'Situation is cleared.' },
    rejected: { icon: <XCircle size={16} />, text: 'Report could not be verified.' },
    awaiting_verify: { icon: <Eye size={16} />, text: 'Waiting for review.' },
  }

  const config =
    (statusConfig as Record<string, { icon: React.ReactNode; text: string }>)[report.status] ??
    statusConfig.awaiting_verify

  const timelineEvents = report.timeline.map((e) => ({
    label: e.event,
    meta: `${e.actor} · ${new Date(e.timestamp).toLocaleString()}`,
    state: 'complete' as const,
  }))

  return (
    <div className="page-container">
      <h1 className="tracking-header tracking-ref">{reference.toUpperCase()}</h1>
      <p className="tracking-meta">
        Reported {report.createdAt ? new Date(report.createdAt).toLocaleString() : 'Loading...'} ·{' '}
        {report.reportType}
      </p>

      <StatusBanner variant={statusVariant} icon={config.icon}>
        <strong>{config.text}</strong>
      </StatusBanner>

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
          <span className="card-value">
            <User
              size={12}
              style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px' }}
            />
            {report.reporterName}
          </span>
        </div>
        <div className="card-row">
          <span className="card-label">Phone</span>
          <span className="card-value">
            <Phone
              size={12}
              style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px' }}
            />
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
        <Button
          variant="primary"
          fullWidth
          onClick={() => (window.location.href = `tel:${RESPONDER_PHONE_NUMBER}`)}
        >
          <PhoneCall size={14} style={{ marginRight: '4px' }} />
          Call responders
        </Button>
      </div>

      {report.status === 'resolved' ? (
        <Button variant="secondary" fullWidth className="mt-2">
          Re-open if situation changed
        </Button>
      ) : null}
    </div>
  )
}
