import { memo } from 'react'
import type { MunicipalityData } from './MunicipalGrid'

interface MunicipalCardProps {
  municipality: MunicipalityData
  onClick: () => void
  isAnimating: boolean
}

function getIncidentCountColor(count: number): string {
  if (count === 0) return '#6c757d'
  if (count <= 2) return '#1a1a2e'
  if (count <= 5) return '#c77600'
  return '#a73400'
}

function getResponseTimeColor(minutes: number | null): string {
  if (minutes === null) return '#6c757d'
  if (minutes < 10) return '#2d6a4f'
  if (minutes <= 20) return '#c77600'
  return '#a73400'
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'responsive':
      return '#2d6a4f'
    case 'slow':
      return '#c77600'
    case 'delayed':
      return '#a73400'
    default:
      return '#6c757d'
  }
}

function getStatusText(status: string): string {
  switch (status) {
    case 'responsive':
      return 'Responsive'
    case 'slow':
      return 'Slow'
    case 'delayed':
      return 'Delayed'
    default:
      return 'Unknown'
  }
}

export const MunicipalCard = memo(function MunicipalCard({
  municipality,
  onClick,
  isAnimating,
}: MunicipalCardProps) {
  const statusColor = getStatusColor(municipality.status)

  return (
    <button
      data-testid="municipal-card"
      data-animating={isAnimating ? 'true' : 'false'}
      onClick={onClick}
      style={{
        display: 'flex',
        flexDirection: 'column',
        padding: '16px',
        backgroundColor: '#ffffff',
        border: '1px solid #dee2e6',
        borderRadius: '8px',
        cursor: 'pointer',
        textAlign: 'left',
        minHeight: '120px',
        animation: isAnimating ? 'worseningSignal 2s ease-out' : 'none',
        borderLeft: `4px solid ${statusColor}`,
      }}
    >
      <div
        style={{
          fontSize: '22px',
          fontWeight: 600,
          color: '#1a1a2e',
          marginBottom: '8px',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {municipality.name}
      </div>

      <div
        style={{
          fontSize: '48px',
          fontWeight: 700,
          fontVariantNumeric: 'tabular-nums',
          color: getIncidentCountColor(municipality.activeIncidents),
          lineHeight: 1.1,
        }}
      >
        {municipality.activeIncidents}
      </div>

      <div
        style={{
          fontSize: '18px',
          color: getResponseTimeColor(municipality.avgResponseTimeMinutes),
          marginTop: '4px',
        }}
      >
        {municipality.avgResponseTimeMinutes !== null
          ? `${String(municipality.avgResponseTimeMinutes)} min`
          : '—'}
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          marginTop: '8px',
        }}
      >
        <div
          style={{
            width: '14px',
            height: '14px',
            borderRadius: '50%',
            backgroundColor: statusColor,
          }}
        />
        <span style={{ fontSize: '14px', fontWeight: 500, color: '#495057' }}>
          {getStatusText(municipality.status)}
        </span>
      </div>
    </button>
  )
})
