import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useDispatch } from '../hooks/useDispatch'
import { useAcceptDispatch } from '../hooks/useAcceptDispatch'
import { useAdvanceDispatch } from '../hooks/useAdvanceDispatch'
import { useDeclineDispatch } from '../hooks/useDeclineDispatch'
import { CancelledScreen } from './CancelledScreen'
import { RaceLossScreen } from './RaceLossScreen'

function Skeleton() {
  return <p>Loading...</p>
}

function NotFound() {
  return <p>Dispatch not found.</p>
}

function ResolveForm({ onSubmit }: { onSubmit: (summary: string) => void }) {
  const [summary, setSummary] = useState('')
  return (
    <div>
      <textarea
        value={summary}
        onChange={(e) => {
          setSummary(e.target.value)
        }}
        placeholder="Resolution summary (required)"
        rows={3}
      />
      <button
        onClick={() => {
          onSubmit(summary)
        }}
        disabled={!summary.trim()}
      >
        Resolve dispatch
      </button>
    </div>
  )
}

function DeclineForm({
  onSubmit,
  loading,
}: {
  onSubmit: (reason: string) => void
  loading: boolean
}) {
  const [reason, setReason] = useState('')
  return (
    <div>
      <textarea
        value={reason}
        onChange={(e) => {
          setReason(e.target.value)
        }}
        placeholder="Decline reason (required)"
        rows={3}
      />
      <button
        onClick={() => {
          onSubmit(reason)
        }}
        disabled={!reason.trim() || loading}
      >
        {loading ? 'Declining…' : 'Submit decline'}
      </button>
    </div>
  )
}

export function DispatchDetailPage() {
  const { dispatchId } = useParams<{ dispatchId: string }>()
  const { dispatch, loading, error } = useDispatch(dispatchId)

  const {
    accept,
    loading: accepting,
    error: acceptError,
  } = useAcceptDispatch(dispatch?.dispatchId ?? '')
  const {
    decline,
    loading: declining,
    error: declineError,
  } = useDeclineDispatch(dispatch?.dispatchId ?? '')

  const advanceAttemptedRef = useRef(false)
  const {
    advance,
    loading: advanceLoading,
    error: advanceError,
  } = useAdvanceDispatch(dispatch?.dispatchId ?? '')
  const advanceState = { advance, loading: advanceLoading, error: advanceError }

  useEffect(() => {
    if (dispatch?.status === 'accepted' && !advanceAttemptedRef.current) {
      advanceAttemptedRef.current = true
      void advance('acknowledged')
    }
  }, [dispatch?.status, advance])

  if (loading) return <Skeleton />
  if (error) return <p>Error: {error.message}</p>
  if (!dispatch) return <NotFound />
  if (dispatch.terminalSurface === 'cancelled') return <CancelledScreen dispatch={dispatch} />
  if (dispatch.terminalSurface === 'race_loss' || acceptError?.message.includes('already-exists')) {
    return <RaceLossScreen />
  }

  return (
    <main>
      <h1>Dispatch {dispatch.dispatchId}</h1>
      <p>Status: {dispatch.uiStatus}</p>
      <p>Report: {dispatch.reportId}</p>
      {dispatch.status === 'pending' && (
        <>
          <button
            onClick={() => {
              void accept()
            }}
            disabled={accepting}
          >
            {accepting ? 'Accepting…' : 'Accept dispatch'}
          </button>
          <DeclineForm
            loading={declining}
            onSubmit={(reason) => {
              void decline(reason)
            }}
          />
        </>
      )}
      {acceptError && <div style={{ color: 'red' }}>Error: {acceptError.message}</div>}
      {declineError && <p style={{ color: 'red' }}>Error: {declineError.message}</p>}
      {dispatch.status === 'acknowledged' && !advanceState.loading && (
        <button
          onClick={() => {
            void advanceState.advance('en_route')
          }}
        >
          Heading there
        </button>
      )}
      {dispatch.status === 'en_route' && !advanceState.loading && (
        <button
          onClick={() => {
            void advanceState.advance('on_scene')
          }}
        >
          Arrived on scene
        </button>
      )}
      {dispatch.status === 'on_scene' && (
        <ResolveForm
          onSubmit={(s) => {
            void advanceState.advance('resolved', { resolutionSummary: s })
          }}
        />
      )}
      {advanceState.loading && <p>Updating...</p>}
      {advanceState.error && (
        <p style={{ color: 'red' }}>
          {advanceState.error.message.includes('permission-denied') ? (
            <em>Dispatch was cancelled by an administrator.</em>
          ) : (
            `Error: ${advanceState.error.message}`
          )}
        </p>
      )}
    </main>
  )
}
