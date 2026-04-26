import { Link, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useAuth } from '@bantayog/shared-ui'
import { useOwnDispatches } from '../hooks/useOwnDispatches'
import { useResponderAvailability } from '../hooks/useResponderAvailability'
import { httpsCallable } from 'firebase/functions'
import { functions } from '../app/firebase'

export function DispatchListPage() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const { rows, groups, error } = useOwnDispatches(user?.uid)
  const { status: availabilityStatus, setAvailability } = useResponderAvailability(user?.uid)
  const activeDispatchId =
    groups.active.length === 1 ? (groups.active[0]?.dispatchId ?? null) : null

  const [selectedStatus, setSelectedStatus] = useState<'available' | 'unavailable' | 'off_duty'>(
    'available',
  )
  const [reason, setReason] = useState('')
  const [statusError, setStatusError] = useState<string | null>(null)
  const [statusSaving, setStatusSaving] = useState(false)

  const [showHandoff, setShowHandoff] = useState(false)
  const [handoffTarget, setHandoffTarget] = useState('')
  const [handoffReason, setHandoffReason] = useState('')
  const [handoffLoading, setHandoffLoading] = useState(false)
  const [handoffError, setHandoffError] = useState<string | null>(null)

  async function handleSignOut() {
    try {
      await signOut()
    } catch (err: unknown) {
      console.error('[DispatchListPage] sign out failed:', err)
    }
  }

  useEffect(() => {
    if (activeDispatchId) {
      void navigate(`/dispatches/${activeDispatchId}`, { replace: true })
    }
  }, [activeDispatchId, navigate])

  async function handleStatusChange() {
    setStatusError(null)
    setStatusSaving(true)
    try {
      await setAvailability(selectedStatus, selectedStatus === 'available' ? undefined : reason)
      setReason('')
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      setStatusError(message)
    } finally {
      setStatusSaving(false)
    }
  }

  async function handleInitiateHandoff() {
    setHandoffError(null)
    if (!handoffTarget.trim() || !handoffReason.trim()) {
      setHandoffError('Target responder and reason are required')
      return
    }
    setHandoffLoading(true)
    try {
      const fn = httpsCallable<
        { toUid: string; reason: string; idempotencyKey: string },
        { success: boolean; handoffId?: string }
      >(functions, 'initiateResponderHandoff')
      await fn({
        toUid: handoffTarget.trim(),
        reason: handoffReason.trim(),
        idempotencyKey: crypto.randomUUID(),
      })
      setHandoffTarget('')
      setHandoffReason('')
      setShowHandoff(false)
    } catch (err: unknown) {
      console.error('[DispatchListPage] handoff failed:', err)
      const message = err instanceof Error ? err.message : String(err)
      setHandoffError(message)
    } finally {
      setHandoffLoading(false)
    }
  }

  return (
    <main>
      <header>
        <h1>Your dispatches</h1>
        <button onClick={() => void handleSignOut()}>Sign out</button>
      </header>

      <section style={{ margin: '1rem 0', padding: '0.5rem', border: '1px solid #ccc' }}>
        <div>
          <strong>Availability:</strong>{' '}
          <span
            style={{
              padding: '0.25rem 0.5rem',
              borderRadius: '4px',
              background:
                availabilityStatus === 'available'
                  ? '#d4edda'
                  : availabilityStatus === 'off_duty'
                    ? '#fff3cd'
                    : '#f8d7da',
            }}
          >
            {availabilityStatus ?? 'loading…'}
          </span>
        </div>
        <div style={{ marginTop: '0.5rem' }}>
          <label htmlFor="status-select">Set status: </label>
          <select
            id="status-select"
            value={selectedStatus}
            onChange={(e) => {
              setSelectedStatus(e.target.value as typeof selectedStatus)
            }}
          >
            <option value="available">Available</option>
            <option value="unavailable">Unavailable</option>
            <option value="off_duty">Off duty</option>
          </select>
          {selectedStatus !== 'available' && (
            <input
              type="text"
              placeholder="Reason (required)"
              value={reason}
              onChange={(e) => {
                setReason(e.target.value)
              }}
              style={{ marginLeft: '0.5rem' }}
            />
          )}
          <button
            onClick={() => void handleStatusChange()}
            disabled={statusSaving}
            style={{ marginLeft: '0.5rem' }}
          >
            {statusSaving ? 'Saving…' : 'Update'}
          </button>
        </div>
        {statusError && <p style={{ color: 'red' }}>{statusError}</p>}
      </section>

      <section style={{ margin: '1rem 0' }}>
        <button
          onClick={() => {
            setShowHandoff((s) => !s)
          }}
        >
          {showHandoff ? 'Cancel handoff' : 'Start Shift Handoff'}
        </button>
        {showHandoff && (
          <div style={{ marginTop: '0.5rem', padding: '0.5rem', border: '1px solid #ccc' }}>
            <div>
              <label htmlFor="handoff-target">Target responder UID: </label>
              <input
                id="handoff-target"
                type="text"
                value={handoffTarget}
                onChange={(e) => {
                  setHandoffTarget(e.target.value)
                }}
                placeholder="responder-uid"
              />
            </div>
            <div style={{ marginTop: '0.5rem' }}>
              <label htmlFor="handoff-reason">Reason: </label>
              <input
                id="handoff-reason"
                type="text"
                value={handoffReason}
                onChange={(e) => {
                  setHandoffReason(e.target.value)
                }}
                placeholder="End of shift"
              />
            </div>
            <button
              onClick={() => void handleInitiateHandoff()}
              disabled={handoffLoading}
              style={{ marginTop: '0.5rem' }}
            >
              {handoffLoading ? 'Sending…' : 'Send handoff'}
            </button>
            {handoffError && <p style={{ color: 'red' }}>{handoffError}</p>}
          </div>
        )}
      </section>

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
