import { useParams } from 'react-router-dom'
import { useReport } from '../hooks/useReport'
import { StatusBanner } from './ui/StatusBanner'
import { Button } from './ui/Button'
import { Timeline } from './ui/Timeline'

const RESPONDER_PHONE_NUMBER = '0547211216'

export function TrackingScreen() {
  const { reference } = useParams<{ reference: string }>()
  const { data: report, isLoading, error } = useReport(reference ?? '')

  if (isLoading) {
    return <div className="p-4">Loading...</div>
  }

  if (error || !report) {
    return (
      <div className="p-4">
        <StatusBanner variant="failed" icon="⚠">
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
    verified: {
      icon: '⚡',
      text: 'Responders dispatched.',
    },
    resolved: {
      icon: '✓',
      text: 'Situation is cleared.',
    },
    rejected: {
      icon: '✗',
      text: 'Report could not be verified.',
    },
    awaiting_verify: {
      icon: '👁',
      text: 'Waiting for review.',
    },
  }

  const config =
    (statusConfig as Record<string, (typeof statusConfig)[keyof typeof statusConfig]>)[
      report.status
    ] ?? statusConfig.awaiting_verify

  const timelineEvents = report.timeline.map((e) => ({
    label: e.event,
    meta: `${e.actor} · ${new Date(e.timestamp).toLocaleString()}`,
    state: 'complete' as const,
  }))

  return (
    <div className="p-4 max-w-md mx-auto">
      <h1 className="text-center font-mono text-xl font-bold text-[#001e40] mb-1">
        {reference.toUpperCase()}
      </h1>
      <p className="text-center text-xs text-[#7b8794] mb-4">
        Reported {report.createdAt ? new Date(report.createdAt).toLocaleString() : 'Loading...'} ·{' '}
        {report.reportType}
      </p>

      <StatusBanner variant={statusVariant} icon={config.icon}>
        <strong>{config.text}</strong>
      </StatusBanner>

      <div className="bg-white rounded-xl p-3.5 mb-3 shadow-sm">
        <h3 className="text-xs font-bold text-[#7b8794] uppercase tracking-wider mb-2">Location</h3>
        <div className="flex justify-between items-center mb-1">
          <span className="text-sm text-[#52606d]">Address</span>
          <span className="text-sm font-medium text-[#1d1d1f]">
            {report.location?.address ?? 'N/A'}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm text-[#52606d]">Coords</span>
          <span className="text-sm font-medium text-[#1d1d1f]">
            {report.location?.lat?.toFixed(5)}, {report.location?.lng?.toFixed(5)}
          </span>
        </div>
      </div>

      <div className="bg-white rounded-xl p-3.5 mb-3 shadow-sm">
        <h3 className="text-xs font-bold text-[#7b8794] uppercase tracking-wider mb-2">
          Your contact
        </h3>
        <div className="flex justify-between items-center mb-1">
          <span className="text-sm text-[#52606d]">Name</span>
          <span className="text-sm font-medium text-[#1d1d1f]">{report.reporterName}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm text-[#52606d]">Phone</span>
          <span className="text-sm font-medium text-[#1d1d1f]">
            {report.reporterPhone && report.reporterPhone.length >= 4
              ? `****-***-${report.reporterPhone.slice(-4)}`
              : 'N/A'}
          </span>
        </div>
      </div>

      {report.resolutionNote && (
        <div className="bg-white rounded-xl p-3.5 mb-3 shadow-sm">
          <h3 className="text-xs font-bold text-[#7b8794] uppercase tracking-wider mb-2">
            Resolution
          </h3>
          <div className="text-sm text-[#52606d] mb-1">{report.resolutionNote}</div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-[#7b8794]">Closed by</span>
            <span className="text-xs font-medium text-[#1d1d1f]">{report.closedBy}</span>
          </div>
        </div>
      )}

      {timelineEvents.length === 0 ? (
        <div className="text-center text-sm text-[#7b8794] py-4">No updates yet</div>
      ) : (
        <Timeline events={timelineEvents} />
      )}

      <div className="flex gap-2 mt-4">
        <Button variant="secondary" fullWidth>
          Update report
        </Button>
        <Button
          variant="primary"
          fullWidth
          onClick={() => (window.location.href = `tel:${RESPONDER_PHONE_NUMBER}`)}
        >
          Call responders
        </Button>
      </div>

      {report.status === 'resolved' && (
        <Button variant="secondary" fullWidth className="mt-2">
          Re-open if situation changed
        </Button>
      )}
    </div>
  )
}
