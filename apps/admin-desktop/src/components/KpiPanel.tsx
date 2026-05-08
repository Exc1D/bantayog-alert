import type { DashboardLiveData } from '../hooks/useDashboardLiveData'

export interface KpiPanelProps {
  liveData: DashboardLiveData
}

interface KpiCardProps {
  label: string
  value: string | number
  testId: string
  severity: 'normal' | 'warning' | 'critical'
}

function getBorderColor(severity: KpiCardProps['severity']): string {
  switch (severity) {
    case 'critical':
      return '#a73400'
    case 'warning':
      return '#c77600'
    default:
      return '#2d6a4f'
  }
}

function KpiCard({ label, value, testId, severity }: KpiCardProps) {
  return (
    <div
      data-testid={testId}
      style={{
        backgroundColor: '#ffffff',
        borderRadius: '8px',
        padding: '20px',
        border: '1px solid #dee2e6',
        borderLeft: `4px solid ${getBorderColor(severity)}`,
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
      }}
    >
      <div
        style={{
          fontSize: '14px',
          fontWeight: 500,
          color: '#6c757d',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: '36px',
          fontWeight: 700,
          color: '#1a1a2e',
          fontVariantNumeric: 'tabular-nums',
          lineHeight: 1.2,
        }}
      >
        {value}
      </div>
    </div>
  )
}

function getActiveSeverity(count: number): KpiCardProps['severity'] {
  if (count >= 20) return 'critical'
  if (count >= 10) return 'warning'
  return 'normal'
}

function getUnresolvedSeverity(count: number): KpiCardProps['severity'] {
  if (count >= 5) return 'critical'
  if (count >= 1) return 'warning'
  return 'normal'
}

function getResponseTimeSeverity(avgTime: string): KpiCardProps['severity'] {
  if (avgTime === '—') return 'normal'
  const minutes = parseInt(avgTime.split(':')[0] ?? '0', 10)
  if (minutes >= 20) return 'critical'
  if (minutes >= 10) return 'warning'
  return 'normal'
}

export function KpiPanel({ liveData }: KpiPanelProps) {
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div
        style={{
          padding: '16px 24px',
          borderBottom: '1px solid #dee2e6',
        }}
      >
        <h2 style={{ fontSize: '24px', fontWeight: 600, margin: 0, color: '#1a1a2e' }}>
          Key Performance Indicators
        </h2>
      </div>

      <div
        style={{
          flex: 1,
          overflow: 'auto',
          padding: '16px',
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '12px',
          alignContent: 'start',
        }}
      >
        <KpiCard
          label="Active Incidents"
          value={liveData.activeIncidents}
          testId="kpi-card-active"
          severity={getActiveSeverity(liveData.activeIncidents)}
        />

        <KpiCard
          label="Responders Available"
          value={liveData.respondersAvailable}
          testId="kpi-card-responders"
          severity="normal"
        />

        <KpiCard
          label="Avg Response Time"
          value={liveData.avgResponseTime}
          testId="kpi-card-response"
          severity={getResponseTimeSeverity(liveData.avgResponseTime)}
        />

        <KpiCard
          label="Resolved Today"
          value={liveData.resolvedToday}
          testId="kpi-card-resolved"
          severity="normal"
        />

        <KpiCard
          label="Unresolved >24h"
          value={liveData.unresolvedOver24h}
          testId="kpi-card-unresolved"
          severity={getUnresolvedSeverity(liveData.unresolvedOver24h)}
        />

        <KpiCard
          label="Municipalities Affected"
          value={liveData.municipalitiesAffected}
          testId="kpi-card-municipalities"
          severity={liveData.municipalitiesAffected >= 5 ? 'warning' : 'normal'}
        />
      </div>
    </div>
  )
}
