import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'

import styles from './PreArrivalInfo.module.css'

const FLOOD_GEAR = [
  'Life vest',
  'Throw bag with rescue rope',
  'Waterproof boots',
  'Headlamp',
  'Whistle',
] as const

const FIRE_GEAR = [
  'SCBA (Self-Contained Breathing Apparatus)',
  'Fire-resistant turnout gear',
  'Helmet with face shield',
  'Heat-resistant gloves',
  'Forcible entry tools',
] as const

const MEDICAL_GEAR = [
  'Defibrillator (AED)',
  'Trauma kit',
  'Oxygen tank with mask',
  'Cervical collar',
  'Pulse oximeter',
] as const

const GENERIC_GEAR = [
  'First aid kit',
  'Flashlight',
  'Communications radio',
  'High-visibility vest',
] as const

interface PreArrivalInfoProps {
  reportType: string
  distanceMeters: number | null
}

function gearForType(reportType: string): readonly string[] {
  if (reportType === 'flood') return FLOOD_GEAR
  if (reportType === 'fire') return FIRE_GEAR
  if (reportType === 'medical') return MEDICAL_GEAR
  return GENERIC_GEAR
}

function formatDistance(meters: number | null): string {
  if (meters === null) {
    return 'Location not available - use Navigate to Scene for routing; enable location access for live distance.'
  }
  if (meters >= 1000) return `${(meters / 1000).toFixed(1)} km`
  return `${String(meters)} m`
}

export function PreArrivalInfo({ reportType, distanceMeters }: PreArrivalInfoProps) {
  const [expanded, setExpanded] = useState(false)
  const [checked, setChecked] = useState<Set<number>>(new Set())

  const items = gearForType(reportType)

  const toggleItem = (index: number) => {
    setChecked((prev) => {
      const next = new Set(prev)
      if (next.has(index)) {
        next.delete(index)
      } else {
        next.add(index)
      }
      return next
    })
  }

  return (
    <div className={styles.container}>
      <button
        type="button"
        className={styles.toggleButton}
        onClick={() => {
          setExpanded((v) => !v)
        }}
        aria-expanded={expanded}
      >
        <span>Pre-arrival info</span>
        {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
      </button>

      {expanded ? (
        <div className={styles.panel}>
          <div className={styles.distance}>
            <strong>Distance:</strong> {formatDistance(distanceMeters)}
          </div>
          <p className={styles.checklistTitle}>Recommended gear checklist</p>
          <ul className={styles.checklist}>
            {items.map((item, index) => (
              <li key={item} className={styles.checklistItem}>
                <label>
                  <input
                    type="checkbox"
                    checked={checked.has(index)}
                    onChange={() => {
                      toggleItem(index)
                    }}
                  />
                  <span>{item}</span>
                </label>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
