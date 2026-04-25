import { useState } from 'react'
import { useAuth } from '@bantayog/shared-ui'
import { useMuniReports, type MuniReportRow } from '../hooks/useMuniReports'
import { ReportDetailPanel } from './ReportDetailPanel'
import { DispatchModal } from './DispatchModal'
import { CloseReportModal } from './CloseReportModal'
import { callables } from '../services/callables'

export function TriageQueuePage() {
  const { claims, signOut } = useAuth()
  const municipalityId =
    typeof claims?.municipalityId === 'string' ? claims.municipalityId : undefined
  const { reports, hasMore, loadMore, loading, error } = useMuniReports(municipalityId)
  const [selected, setSelected] = useState<string | null>(null)
  const [dispatchForReportId, setDispatchForReportId] = useState<string | null>(null)
  const [closeForReportId, setCloseForReportId] = useState<string | null>(null)
  const [banner, setBanner] = useState<string | null>(null)

  const handleVerify = (reportId: string) => {
    void (async () => {
      try {
        await callables.verifyReport({ reportId, idempotencyKey: crypto.randomUUID() })
        setBanner(null)
      } catch (err: unknown) {
        setBanner(err instanceof Error ? err.message : 'Verify failed')
      }
    })()
  }

  const handleReject = (reportId: string) => {
    const reason = prompt(
      'Reject reason (obviously_false, duplicate, test_submission, insufficient_detail)?',
    )
    if (!reason) return
    void (async () => {
      try {
        await callables.rejectReport({
          reportId,
          reason: reason as
            | 'obviously_false'
            | 'duplicate'
            | 'test_submission'
            | 'insufficient_detail',
          idempotencyKey: crypto.randomUUID(),
        })
      } catch (err: unknown) {
        setBanner(err instanceof Error ? err.message : 'Reject failed')
      }
    })()
  }

  return (
    <main>
      <header>
        <h1>Triage · {municipalityId ?? 'N/A'}</h1>
        <button onClick={() => void signOut()}>Sign out</button>
      </header>
      {banner && <div role="alert">{banner}</div>}
      <section style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div>
          <h2>Queue</h2>
          {loading ? (
            <p>Loading…</p>
          ) : error ? (
            <p role="alert">Error: {error}</p>
          ) : reports.length === 0 ? (
            <p>No active reports.</p>
          ) : (
            <>
              <p>
                Showing {reports.length}
                {hasMore ? '+' : ''} reports
              </p>
              <ul>
                {reports.map((r: MuniReportRow) => (
                  <li key={r.reportId}>
                    <button
                      onClick={() => {
                        setSelected(r.reportId)
                      }}
                    >
                      [{r.status}] {r.severity}
                      {r.duplicateClusterId ? ' [dup]' : ''} — {r.reportId.slice(0, 8)}
                    </button>
                  </li>
                ))}
              </ul>
              {hasMore && <button onClick={loadMore}>Load More</button>}
            </>
          )}
        </div>
        {selected && (
          <ReportDetailPanel
            reportId={selected}
            onVerify={handleVerify}
            onReject={handleReject}
            onDispatch={setDispatchForReportId}
            onClose={setCloseForReportId}
          />
        )}
      </section>
      {dispatchForReportId && (
        <DispatchModal
          reportId={dispatchForReportId}
          onClose={() => {
            setDispatchForReportId(null)
          }}
          onError={(msg: string) => {
            setBanner(msg)
          }}
        />
      )}
      {closeForReportId && (
        <CloseReportModal
          reportId={closeForReportId}
          onClose={() => {
            setCloseForReportId(null)
          }}
          onError={(msg: string) => {
            setBanner(msg)
          }}
        />
      )}
    </main>
  )
}
