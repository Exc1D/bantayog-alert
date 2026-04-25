import { useState, useEffect } from 'react'
import { collection, query, where, onSnapshot, type Unsubscribe } from 'firebase/firestore'
import { db } from '../app/firebase'
import { callables } from '../services/callables'
import { useAuth } from '@bantayog/shared-ui'

interface AgencyAssistanceRequest {
  id: string
  reportId: string
  requestedByMunicipality: string
  message: string
  priority: 'urgent' | 'normal'
  status: 'pending' | 'accepted' | 'declined' | 'fulfilled' | 'expired'
  targetAgencyId: string
  createdAt: number
}

type FilterTab = 'pending' | 'accepted' | 'all'

interface DeclineState {
  requestId: string
  reason: string
}

export function AgencyAssistanceQueuePage() {
  const { claims } = useAuth()
  const agencyId = typeof claims?.agencyId === 'string' ? claims.agencyId : undefined
  const [requests, setRequests] = useState<AgencyAssistanceRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<FilterTab>('pending')
  const [declineState, setDeclineState] = useState<DeclineState | null>(null)
  const [banner, setBanner] = useState<string | null>(null)

  useEffect(() => {
    queueMicrotask(() => {
      setRequests([])
      setError(null)
      setDeclineState(null)
      setBanner(null)
    })

    if (!agencyId) {
      queueMicrotask(() => {
        setLoading(false)
      })
      return
    }

    queueMicrotask(() => {
      setLoading(true)
    })

    const q = query(
      collection(db, 'agency_assistance_requests'),
      where('targetAgencyId', '==', agencyId),
    )

    const unsubscribe: Unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const docs: AgencyAssistanceRequest[] = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as AgencyAssistanceRequest[]
        setRequests(docs)
        setLoading(false)
      },
      (err) => {
        setError(err.message)
        setLoading(false)
      },
    )

    return () => {
      unsubscribe()
    }
  }, [agencyId])

  const filteredRequests = requests.filter((r) => {
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
      ) : filteredRequests.length === 0 ? (
        <p>No requests.</p>
      ) : (
        <ul>
          {filteredRequests.map((req) => (
            <li key={req.id} style={{ marginBottom: 16, border: '1px solid #ccc', padding: 12 }}>
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

              {req.status === 'pending' && (
                <div style={{ marginTop: 8 }}>
                  {declineState?.requestId === req.id ? (
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
                        <button
                          onClick={handleDeclineSubmit}
                          disabled={!declineState.reason.trim()}
                        >
                          Submit Decline
                        </button>
                        <button onClick={handleDeclineCancel}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        onClick={() => {
                          handleAccept(req.id)
                        }}
                      >
                        Accept
                      </button>
                      <button
                        onClick={() => {
                          handleDecline(req.id)
                        }}
                      >
                        Decline
                      </button>
                    </div>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
