import { useState } from 'react'
import { callables } from '../services/callables'
import { useAuth } from '@bantayog/shared-ui'
import { useAgencyAssistanceQueue } from '../hooks/useAgencyAssistanceQueue'

type FilterTab = 'pending' | 'accepted' | 'all'

interface DeclineState {
  requestId: string
  reason: string
}

export function AgencyAssistanceQueuePage() {
  const { claims } = useAuth()
  const agencyId = typeof claims?.agencyId === 'string' ? claims.agencyId : undefined
  const { requests, backupRequests, loading, error } = useAgencyAssistanceQueue(agencyId)
  const [filter, setFilter] = useState<FilterTab>('pending')
  const [declineState, setDeclineState] = useState<DeclineState | null>(null)
  const [banner, setBanner] = useState<string | null>(null)

  const filteredRequests = requests.filter((r) => {
    if (filter === 'pending') return r.status === 'pending'
    if (filter === 'accepted') return r.status === 'accepted'
    return true
  })

  const filteredBackupRequests = backupRequests.filter((r) => {
    if (filter === 'pending') return r.status === 'pending'
    if (filter === 'accepted') return r.status === 'accepted'
    return true
  })

  const handleAccept = (requestId: string) => {
    void (async () => {
      try {
        await callables.acceptAgencyAssistance({
          requestId,
          idempotencyKey: crypto.randomUUID(),
        })
        setBanner(null)
      } catch (err: unknown) {
        setBanner(err instanceof Error ? err.message : 'Accept failed')
      }
    })()
  }

  const handleDecline = (requestId: string) => {
    setDeclineState({ requestId, reason: '' })
  }

  const handleDeclineSubmit = () => {
    if (!declineState || declineState.reason.trim() === '') return
    void (async () => {
      try {
        await callables.declineAgencyAssistance({
          requestId: declineState.requestId,
          reason: declineState.reason.trim(),
          idempotencyKey: crypto.randomUUID(),
        })
        setDeclineState(null)
        setBanner(null)
      } catch (err: unknown) {
        setBanner(err instanceof Error ? err.message : 'Decline failed')
      }
    })()
  }

  const handleDeclineCancel = () => {
    setDeclineState(null)
  }

  const renderRequestActions = (
    reqId: string,
    status: 'pending' | 'accepted' | 'declined' | 'fulfilled' | 'expired',
    kind: 'agency' | 'backup',
  ) => {
    if (status !== 'pending') return null
    if (kind === 'backup') {
      return (
        <div style={{ marginTop: 8 }}>
          <span style={{ fontSize: '0.875rem', color: '#666' }}>
            Backup request actions not yet available.
          </span>
        </div>
      )
    }
    return (
      <div style={{ marginTop: 8 }}>
        {declineState?.requestId === reqId ? (
          <div>
            <textarea
              placeholder="Reason for declining..."
              value={declineState.reason}
              onChange={(e) => {
                setDeclineState({ ...declineState, reason: e.target.value })
              }}
              style={{ display: 'block', width: '100%', marginBottom: 8 }}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={handleDeclineSubmit} disabled={!declineState.reason.trim()}>
                Submit Decline
              </button>
              <button onClick={handleDeclineCancel}>Cancel</button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => {
                handleAccept(reqId)
              }}
            >
              Accept
            </button>
            <button
              onClick={() => {
                handleDecline(reqId)
              }}
            >
              Decline
            </button>
          </div>
        )}
      </div>
    )
  }

  return (
    <main>
      <header>
        <h1>Agency Assistance</h1>
      </header>
      {banner && <div role="alert">{banner}</div>}

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {(['pending', 'accepted', 'all'] as FilterTab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => {
              setFilter(tab)
            }}
            disabled={filter === tab}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {loading ? (
        <p>Loading…</p>
      ) : error ? (
        <p role="alert">Error: {error}</p>
      ) : (
        <>
          <h2>Agency Assistance Requests</h2>
          {filteredRequests.length === 0 ? (
            <p>No agency assistance requests.</p>
          ) : (
            <ul>
              {filteredRequests.map((req) => (
                <li
                  key={req.id}
                  style={{ marginBottom: 16, border: '1px solid #ccc', padding: 12 }}
                >
                  <p>
                    <strong>{req.requestedByMunicipality}</strong>
                    {' — '}
                    <span
                      style={{
                        color: req.priority === 'urgent' ? 'red' : 'gray',
                        fontWeight: req.priority === 'urgent' ? 'bold' : 'normal',
                      }}
                    >
                      [{req.priority}]
                    </span>
                  </p>
                  <p>{req.message}</p>
                  <p style={{ fontSize: '0.875rem', color: '#666' }}>Report: {req.reportId}</p>
                  {renderRequestActions(req.id, req.status, 'agency')}
                </li>
              ))}
            </ul>
          )}

          <h2 style={{ marginTop: 24 }}>Backup Requests</h2>
          {filteredBackupRequests.length === 0 ? (
            <p>No backup requests.</p>
          ) : (
            <ul>
              {filteredBackupRequests.map((req) => (
                <li
                  key={req.id}
                  style={{ marginBottom: 16, border: '1px solid #ccc', padding: 12 }}
                >
                  <p>
                    <strong>{req.municipalityId}</strong>
                    {' — '}
                    <span style={{ color: 'gray' }}>[normal]</span>
                  </p>
                  <p>{req.reason}</p>
                  <p style={{ fontSize: '0.875rem', color: '#666' }}>Report: {req.reportId}</p>
                  {renderRequestActions(req.id, req.status, 'backup')}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </main>
  )
}
