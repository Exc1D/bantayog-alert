import { useMemo } from 'react'
import { FALLBACK_BARANGAYS, MUNICIPALITY_LABELS } from './location-constants.js'

interface BarangaySelectorProps {
  municipalityId: string
  value: string
  onChange: (barangayId: string) => void
}

export function BarangaySelector({ municipalityId, value, onChange }: BarangaySelectorProps) {
  const barangayOptions = useMemo(() => {
    if (!municipalityId) return []
    return FALLBACK_BARANGAYS.filter(
      (b) => MUNICIPALITY_LABELS[municipalityId] === b.municipality,
    ).sort((a, b) => a.name.localeCompare(b.name))
  }, [municipalityId])

  if (!municipalityId) {
    return null
  }

  return (
    <div className="field-group">
      <p className="field-label">
        Barangay
        <span className="field-label-optional"> — optional</span>
      </p>
      <select
        className="text-select"
        value={value}
        onChange={(e) => {
          onChange(e.target.value)
        }}
      >
        <option value="">Select barangay (optional)...</option>
        {barangayOptions.map((b) => (
          <option key={b.name} value={b.name}>
            {b.name}
          </option>
        ))}
      </select>
    </div>
  )
}
