import { useReportDetail } from '../hooks/useReportDetail'

export function ReportDetailPanel({
  reportId,
  onVerify,
  onReject,
  onDispatch,
}: {
  reportId: string
  onVerify: (reportId: string) => void
  onReject: (reportId: string) => void
  onDispatch: (reportId: string) => void
}) {
  const { report, ops, error } = useReportDetail(reportId)
  if (error) return <aside role="alert">Error loading report: {error}</aside>
  if (!report) return <aside>Loading…</aside>

  const canVerify = report.status === 'new' || report.status === 'awaiting_verify'
  const canReject = report.status === 'awaiting_verify'
  const canDispatch = report.status === 'verified'

  return (
    <aside>
      <h2>Report {reportId.slice(0, 8)}</h2>
      <dl>
        <dt>Status</dt>
        <dd>{report.status}</dd>
        <dt>Severity</dt>
        <dd>{report.severityDerived}</dd>
        <dt>Municipality</dt>
        <dd>{report.municipalityLabel}</dd>
        <dt>Created</dt>
        <dd>{report.createdAt.toDate().toLocaleString()}</dd>
        {ops && (
          <>
            <dt>Queue priority</dt>
            <dd>{ops.verifyQueuePriority}</dd>
          </>
        )}
      </dl>
      <div>
        <button
          disabled={!canVerify}
          onClick={() => {
            onVerify(reportId)
          }}
        >
          {report.status === 'new' ? 'Open for verify' : 'Verify'}
        </button>
        <button
          disabled={!canReject}
          onClick={() => {
            onReject(reportId)
          }}
        >
          Reject
        </button>
        <button
          disabled={!canDispatch}
          onClick={() => {
            onDispatch(reportId)
          }}
        >
          Dispatch
        </button>
      </div>
    </aside>
  )
}
