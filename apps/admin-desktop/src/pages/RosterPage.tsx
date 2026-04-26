import { useState, useEffect } from 'react'
import { useAuth } from '@bantayog/shared-ui'
import { useRosterManagement } from '../hooks/useRosterManagement'
import { computeFreshness, type Freshness } from '../utils/freshness'

const FRESHNESS_COLOR: Record<Freshness, string> = {
  fresh: 'green',
  degraded: 'orange',
  stale: '#c60',
  offline: '#999',
}

export function RosterPage() {
  const { claims } = useAuth()
  const agencyId = typeof claims?.agencyId === 'string' ? claims.agencyId : undefined
  const {
    responders,
    loading,
    error,
    suspendResponder,
    revokeResponder,
    bulkAvailabilityOverride,
  } = useRosterManagement(agencyId)
  const [selectedUids, setSelectedUids] = useState<Set<string>>(new Set())
  const [bulkStatus, setBulkStatus] = useState<'available' | 'unavailable' | 'off_duty'>(
    'available',
  )
  const [banner, setBanner] = useState<string | null>(null)
  const [actingUid, setActingUid] = useState<string | null>(null)
  const [bulkLoading, setBulkLoading] = useState(false)
  const [, setTick] = useState(0)

  useEffect(() => {
    const id = setInterval(() => {
      setTick((t) => t + 1)
    }, 30_000)
    return () => {
      clearInterval(id)
    }
  }, [])

  const toggleSelection = (uid: string) => {
    setSelectedUids((prev) => {
      const next = new Set(prev)
      if (next.has(uid)) {
        next.delete(uid)
      } else {
        next.add(uid)
      }
      return next
    })
  }

  const handleSuspend = (uid: string) => {
    void (async () => {
      setActingUid(uid)
      try {
        await suspendResponder(uid)
        setBanner(null)
      } catch (err: unknown) {
        setBanner(err instanceof Error ? err.message : 'Suspend failed')
      } finally {
        setActingUid(null)
      }
    })()
  }

  const handleRevoke = (uid: string) => {
    void (async () => {
      setActingUid(uid)
      try {
        await revokeResponder(uid)
        setBanner(null)
      } catch (err: unknown) {
        setBanner(err instanceof Error ? err.message : 'Revoke failed')
      } finally {
        setActingUid(null)
      }
    })()
  }

  const handleBulkOverride = () => {
    if (selectedUids.size === 0) return
    void (async () => {
      setBulkLoading(true)
      try {
        await bulkAvailabilityOverride(Array.from(selectedUids), bulkStatus)
        setSelectedUids(new Set())
        setBanner(null)
      } catch (err: unknown) {
        setBanner(err instanceof Error ? err.message : 'Bulk override failed')
      } finally {
        setBulkLoading(false)
      }
    })()
  }

  return (
    <main>
      <header>
        <h1>Roster · {agencyId ?? 'N/A'}</h1>
      </header>
      {banner && <div role="alert">{banner}</div>}

      {selectedUids.size > 0 && (
        <div style={{ marginBottom: 16, display: 'flex', gap: 8, alignItems: 'center' }}>
          <span>Bulk override ({selectedUids.size} selected):</span>
          <select
            value={bulkStatus}
            onChange={(e) => {
              const value = e.target.value as 'available' | 'unavailable' | 'off_duty'
              setBulkStatus(value)
            }}
          >
            <option value="available">Available</option>
            <option value="unavailable">Unavailable</option>
            <option value="off_duty">Off Duty</option>
          </select>
          <button onClick={handleBulkOverride} disabled={bulkLoading || selectedUids.size === 0}>
            Apply
          </button>
        </div>
      )}

      {loading ? (
        <p>Loading…</p>
      ) : error ? (
        <p role="alert">Error: {error}</p>
      ) : responders.length === 0 ? (
        <p>No responders.</p>
      ) : (
        <ul>
          {responders.map((r) => {
            const freshness = computeFreshness(r.lastTelemetryAt)
            return (
              <li key={r.uid} style={{ marginBottom: 12, border: '1px solid #ccc', padding: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <input
                    type="checkbox"
                    checked={selectedUids.has(r.uid)}
                    onChange={() => {
                      toggleSelection(r.uid)
                    }}
                    aria-label={`Select ${r.displayName}`}
                  />
                  <strong>{r.displayName}</strong>
                  <span
                    style={{
                      padding: '2px 6px',
                      borderRadius: 4,
                      background: '#eee',
                      fontSize: '0.75rem',
                      textTransform: 'uppercase',
                    }}
                  >
                    {r.availabilityStatus}
                  </span>
                  {r.lastTelemetryAt != null && (
                    <span style={{ fontSize: '0.75rem', color: FRESHNESS_COLOR[freshness] }}>
                      {freshness} · {new Date(r.lastTelemetryAt).toLocaleTimeString()}
                    </span>
                  )}
                </div>
                <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                  <button
                    disabled={actingUid === r.uid}
                    onClick={() => {
                      if (
                        window.confirm(
                          `Suspend responder ${r.displayName}? This will set them off-duty.`,
                        )
                      ) {
                        handleSuspend(r.uid)
                      }
                    }}
                  >
                    Suspend
                  </button>
                  <button
                    disabled={actingUid === r.uid}
                    onClick={() => {
                      if (
                        window.confirm(
                          `Revoke responder ${r.displayName}? This action cannot be self-undone.`,
                        )
                      ) {
                        handleRevoke(r.uid)
                      }
                    }}
                  >
                    Revoke
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </main>
  )
}
