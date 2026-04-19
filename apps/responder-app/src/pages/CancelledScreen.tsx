import { Link } from 'react-router-dom'
import type { DispatchDoc } from '../hooks/useDispatch'

interface CancelledScreenProps {
  dispatch: DispatchDoc
}

export function CancelledScreen({ dispatch }: CancelledScreenProps) {
  const reason = dispatch.cancelReason

  return (
    <main>
      <h1>This dispatch was cancelled</h1>
      {reason && <p>Reason: {reason}</p>}
      <p>
        <Link to="/">Back to list</Link>
      </p>
    </main>
  )
}
