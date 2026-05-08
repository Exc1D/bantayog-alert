import { motion } from 'framer-motion'
import { useReducedMotion } from '../hooks/useReducedMotion'
import type { IncidentFeedItem } from './IncidentFeed'

interface AnimatedIncidentCardProps {
  incident: IncidentFeedItem
  index: number
}

function getSeverityBorderColor(severity: IncidentFeedItem['severity']): string {
  switch (severity) {
    case 'critical':
      return '#a73400'
    case 'high':
      return '#c77600'
    case 'medium':
      return '#2d6a4f'
    case 'low':
      return '#6c757d'
    default:
      return '#6c757d'
  }
}

function getSeverityBackground(severity: IncidentFeedItem['severity']): string {
  switch (severity) {
    case 'critical':
      return '#fff3cd'
    case 'high':
      return '#ffe5b4'
    default:
      return '#ffffff'
  }
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function AnimatedIncidentCard({ incident, index }: AnimatedIncidentCardProps) {
  const prefersReducedMotion = useReducedMotion()

  const cardContent = (
    <div
      data-testid="incident-card"
      style={{
        backgroundColor: getSeverityBackground(incident.severity),
        borderRadius: '8px',
        padding: '16px',
        border: '1px solid #dee2e6',
        borderLeft: `4px solid ${getSeverityBorderColor(incident.severity)}`,
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '8px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span
            style={{
              width: '12px',
              height: '12px',
              borderRadius: '50%',
              backgroundColor:
                incident.severity === 'critical'
                  ? '#a73400'
                  : incident.severity === 'high'
                    ? '#c77600'
                    : '#2d6a4f',
              display: 'inline-block',
            }}
          />
          <span
            style={{
              fontSize: '18px',
              fontWeight: 600,
              color: '#1a1a2e',
            }}
          >
            {incident.type}
          </span>
        </div>
        <span style={{ fontSize: '14px', color: '#6c757d' }}>{formatTime(incident.timestamp)}</span>
      </div>

      <div
        style={{
          fontSize: '16px',
          color: '#495057',
          marginBottom: '12px',
        }}
      >
        {incident.municipality} · {incident.status}
      </div>
    </div>
  )

  if (prefersReducedMotion) {
    return cardContent
  }

  return (
    <motion.div
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{
        duration: 0.3,
        delay: index * 0.05,
        ease: 'easeOut',
      }}
    >
      {cardContent}
    </motion.div>
  )
}
