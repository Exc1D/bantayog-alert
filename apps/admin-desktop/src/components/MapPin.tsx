import { motion } from 'framer-motion'
import { useReducedMotion } from '../hooks/useReducedMotion'
import type { Incident } from './ProvincialMap'

interface MapPinProps {
  incident: Incident
}

function getSeverityColor(severity: Incident['severity']): string {
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

export function MapPin({ incident }: MapPinProps) {
  const prefersReducedMotion = useReducedMotion()

  const pinContent = (
    <div
      data-testid="map-pin"
      style={{
        backgroundColor: getSeverityColor(incident.severity),
        color: '#ffffff',
        padding: '8px 12px',
        borderRadius: '8px',
        fontSize: '14px',
        fontWeight: 600,
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
        minWidth: '80px',
        textAlign: 'center',
      }}
    >
      <div>{incident.type}</div>
      <div style={{ fontSize: '12px', opacity: 0.9 }}>{incident.municipality}</div>
    </div>
  )

  if (prefersReducedMotion) {
    return pinContent
  }

  return (
    <motion.div
      initial={{ y: -30, scale: 1.3, opacity: 0 }}
      animate={{
        y: 0,
        scale: 1,
        opacity: 1,
      }}
      transition={{
        type: 'spring',
        stiffness: 300,
        damping: 15,
        mass: 0.8,
      }}
    >
      {pinContent}
    </motion.div>
  )
}
