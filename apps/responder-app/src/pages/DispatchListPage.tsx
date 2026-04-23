import { Link, useNavigate } from 'react-router-dom'
import { useEffect } from 'react'
import { useAuth } from '../app/auth-provider'
import { useOwnDispatches } from '../hooks/useOwnDispatches'

export function DispatchListPage() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const { rows, groups, error } = useOwnDispatches(user?.uid)
  const activeDispatchId =
    groups.active.length === 1 ? (groups.active[0]?.dispatchId ?? null) : null

  useEffect(() => {
    if (activeDispatchId) {
      void navigate(`/dispatches/${activeDispatchId}`, { replace: true })
    }
  }, [activeDispatchId, navigate])

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
        <>
          <section>
            <h2>Pending</h2>
            {groups.pending.length === 0 ? (
              <p>No pending dispatches.</p>
            ) : (
              <ul>
                {groups.pending.map((row) => (
                  <li key={row.dispatchId}>
                    <Link to={`/dispatches/${row.dispatchId}`}>
                      <strong>{row.status}</strong> — report {row.reportId.slice(0, 8)}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section>
            <h2>Active</h2>
            {groups.active.length === 0 ? (
              <p>No active dispatches.</p>
            ) : (
              <ul>
                {groups.active.map((r) => (
                  <li key={r.dispatchId}>
                    <Link to={`/dispatches/${r.dispatchId}`}>
                      <strong>{r.uiStatus ?? r.status}</strong> — report {r.reportId.slice(0, 8)}
                    </Link>
                    {r.acknowledgementDeadlineAt && (
                      <small>
                        {' '}
                        · ack by {r.acknowledgementDeadlineAt.toDate().toLocaleTimeString()}
                      </small>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </main>
  )
}
