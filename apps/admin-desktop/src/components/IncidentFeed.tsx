import { AnimatedIncidentCard } from './AnimatedIncidentCard'

export interface IncidentFeedItem {
  id: string
  location: { lat: number; lng: number }
  severity: 'critical' | 'high' | 'medium' | 'low'
  type: string
  municipality: string
  timestamp: Date
  status: string
}

interface IncidentFeedProps {
  incidents: IncidentFeedItem[]
  onTriage: (incidentId: string) => void
  onDispatch: (incidentId: string) => void
  onView: (incidentId: string) => void
}

export function IncidentFeed({
  incidents,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onTriage: _onTriage,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onDispatch: _onDispatch,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onView: _onView,
}: IncidentFeedProps) {
  const sortedIncidents = [...incidents].sort(
    (a, b) => b.timestamp.getTime() - a.timestamp.getTime(),
  )

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div
        style={{
          padding: '16px 24px',
          borderBottom: '1px solid #dee2e6',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <h2 style={{ fontSize: '24px', fontWeight: 600, margin: 0, color: '#1a1a2e' }}>
          Active Incidents
        </h2>
        <div
          style={{
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            backgroundColor: '#001e40',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '20px',
            fontWeight: 600,
          }}
        >
          {incidents.length}
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '16px' }}>
        {sortedIncidents.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              padding: '48px 24px',
              color: '#6c757d',
              fontSize: '18px',
            }}
          >
            No active incidents
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {sortedIncidents.map((incident, index) => (
              <AnimatedIncidentCard key={incident.id} incident={incident} index={index} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
