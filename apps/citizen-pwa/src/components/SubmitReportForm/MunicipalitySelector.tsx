import { MUNI_LABELS_SORTED } from './location-constants.js'

interface MunicipalitySelectorProps {
  value: string
  onChange: (municipalityId: string) => void
  error?: string | null
}

export function MunicipalitySelector({ value, onChange, error }: MunicipalitySelectorProps) {
  const municipalityErrorId = error ? 'report-municipality-error' : undefined
  return (
    <div className="field-group">
      <label htmlFor="report-municipality" className="field-label">
        Municipality
      </label>
      <select
        id="report-municipality"
        name="municipality"
        aria-invalid={Boolean(error)}
        aria-describedby={municipalityErrorId}
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
      {error ? (
        <p id="report-municipality-error" className="field-error">
          {error}
        </p>
      ) : null}
    </div>
  )
}
