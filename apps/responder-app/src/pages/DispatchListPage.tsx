import { useAuth } from '../app/auth-provider'
import { useOwnDispatches } from '../hooks/useOwnDispatches'

export function DispatchListPage() {
  const { user, signOut } = useAuth()
  const { rows, error } = useOwnDispatches(user?.uid)
  return (
    <main>
      <header>
        <h1>Your dispatches</h1>
        <button onClick={() => void signOut()}>Sign out</button>
      </header>
      {error && <p style={{ color: 'red' }}>Failed to load dispatches: {error}</p>}
      {rows.length === 0 ? (
        <p>No active dispatches.</p>
      ) : (
        <ul>
          {rows.map((r) => (
            <li key={r.dispatchId}>
              <strong>{r.status}</strong> — report {r.reportId.slice(0, 8)}
              {r.acknowledgementDeadlineAt && (
                <small> · ack by {r.acknowledgementDeadlineAt.toDate().toLocaleTimeString()}</small>
              )}
            </li>
          ))}
        </ul>
      )}
      <p>
        <em>Accept/Decline actions land in Phase 3c.</em>
      </p>
    </main>
  )
}
