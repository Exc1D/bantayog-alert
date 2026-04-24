import { MUNI_LABELS_SORTED } from './location-constants.js'

interface MunicipalitySelectorProps {
  value: string
  onChange: (municipalityId: string) => void
  error?: string | null
}

export function MunicipalitySelector({ value, onChange, error }: MunicipalitySelectorProps) {
  return (
    <div className="field-group">
      <p className="field-label">Municipality</p>
      <select
        className="text-select"
        value={value}
        onChange={(e) => {
          onChange(e.target.value)
        }}
      >
        <option value="">Select municipality...</option>
        {MUNI_LABELS_SORTED.map((m) => (
          <option key={m.id} value={m.id}>
            {m.label}
          </option>
        ))}
      </select>
      {error ? <p className="field-error">{error}</p> : null}
    </div>
  )
}
