import { useParams } from 'react-router-dom'
import { useDispatch } from '../hooks/useDispatch'

function Skeleton() {
  return <p>Loading...</p>
}

function NotFound() {
  return <p>Dispatch not found.</p>
}

export function DispatchDetailPage() {
  const { dispatchId } = useParams<{ dispatchId: string }>()
  const { dispatch, loading, error } = useDispatch(dispatchId)

  if (loading) return <Skeleton />
  if (error) return <p>Error: {error.message}</p>
  if (!dispatch) return <NotFound />

  return (
    <main>
      <h1>Dispatch {dispatch.dispatchId}</h1>
      <p>Status: {dispatch.status}</p>
      <p>Report: {dispatch.reportId}</p>
      {/* Accept + progression buttons land in Task 16 */}
    </main>
  )
}
