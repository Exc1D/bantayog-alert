import { useParams } from 'react-router-dom'
import { useDispatch } from '../hooks/useDispatch'
import { useAcceptDispatch } from '../hooks/useAcceptDispatch'

function Skeleton() {
  return <p>Loading...</p>
}

function NotFound() {
  return <p>Dispatch not found.</p>
}

function RaceLostBanner() {
  return (
    <p style={{ color: 'orange' }}>
      This dispatch was already accepted. The list will update automatically.
    </p>
  )
}

export function DispatchDetailPage() {
  const { dispatchId } = useParams<{ dispatchId: string }>()
  const { dispatch, loading, error } = useDispatch(dispatchId)

  // Accept button only valid when dispatch is loaded (dispatchId guaranteed non-undefined after loading check)
  const {
    accept,
    loading: accepting,
    error: acceptError,
  } = useAcceptDispatch(dispatch?.dispatchId ?? '')

  if (loading) return <Skeleton />
  if (error) return <p>Error: {error.message}</p>
  if (!dispatch) return <NotFound />

  return (
    <main>
      <h1>Dispatch {dispatch.dispatchId}</h1>
      <p>Status: {dispatch.status}</p>
      <p>Report: {dispatch.reportId}</p>
      {dispatch.status === 'pending' && (
        <button
          onClick={() => {
            void accept()
          }}
          disabled={accepting}
        >
          {accepting ? 'Accepting…' : 'Accept dispatch'}
        </button>
      )}
      {acceptError && (
        <p style={{ color: 'red' }}>
          {acceptError.message.includes('already-exists') ? (
            <RaceLostBanner />
          ) : (
            `Error: ${acceptError.message}`
          )}
        </p>
      )}
    </main>
  )
}
