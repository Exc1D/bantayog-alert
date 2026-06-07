import {
  HAZARD_GROUPS,
  HAZARD_TYPE_LABELS,
  MUNICIPALITIES,
  MUNICIPALITY_ID_TO_LABEL,
  BARANGAYS_BY_MUNICIPALITY,
  SECTOR_LABELS,
  SECTOR_TYPES,
} from './declare-alert-options'
import { REQUIRES_EFFECTIVE_PERIOD, SHOWS_ROAD_NAME } from './declare-alert-form'
import type { DeclareAlertValidationErrors } from './declare-alert-form'

interface AlertFormFieldsProps {
  hazardType: string
  selectedMunicipalityIds: ReadonlySet<string>
  showBarangaySelector: boolean
  selectedBarangayIds: ReadonlySet<string>
  selectedSectors: ReadonlySet<string>
  effectiveFrom: string
  effectiveUntil: string
  expectedResolutionAt: string
  roadName: string
  message: string
  submitError: string | null
  validationErrors: DeclareAlertValidationErrors
  selectedMunicipalitySummary: string
  onHazardTypeChange: (type: string) => void
  onToggleMunicipality: (id: string) => void
  onToggleBarangay: (barangay: string) => void
  onToggleAllBarangaysForMunicipality: (municipalityId: string, checked: boolean) => void
  onToggleSector: (sector: string) => void
  onSetShowBarangaySelector: (value: boolean | ((prev: boolean) => boolean)) => void
  onSetEffectiveFrom: (value: string) => void
  onSetEffectiveUntil: (value: string) => void
  onSetExpectedResolutionAt: (value: string) => void
  onSetRoadName: (value: string) => void
  onSetMessage: (value: string) => void
}

export function AlertFormFields(props: AlertFormFieldsProps) {
  const {
    hazardType,
    selectedMunicipalityIds,
    showBarangaySelector,
    selectedBarangayIds,
    selectedSectors,
    effectiveFrom,
    effectiveUntil,
    expectedResolutionAt,
    roadName,
    message,
    submitError,
    validationErrors,
    selectedMunicipalitySummary,
    onHazardTypeChange,
    onToggleMunicipality,
    onToggleBarangay,
    onToggleAllBarangaysForMunicipality,
    onToggleSector,
    onSetShowBarangaySelector,
    onSetEffectiveFrom,
    onSetEffectiveUntil,
    onSetExpectedResolutionAt,
    onSetRoadName,
    onSetMessage,
  } = props

  return (
    <div className="space-y-5">
      {submitError && (
        <div
          role="alert"
          className="rounded-md border border-[var(--color-danger)]/40 bg-[var(--color-danger)]/10 px-3 py-2"
        >
          <p className="text-sm font-medium text-[var(--color-danger)]">{submitError}</p>
          <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
            Review the details, then try again.
          </p>
        </div>
      )}

      {/* Hazard Type */}
      <div>
        <label
          htmlFor="hazard-type"
          className="block text-sm font-medium text-[var(--color-text-secondary)]"
        >
          Alert Type (required)
        </label>
        <select
          id="hazard-type"
          value={hazardType}
          onChange={(e) => {
            onHazardTypeChange(e.target.value)
          }}
          className="mt-1 w-full rounded border border-white/10 bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-primary)]"
        >
          <option value="">Select alert type...</option>
          {HAZARD_GROUPS.map((group) => (
            <optgroup key={group.label} label={group.label}>
              {group.types.map((type) => (
                <option key={type} value={type}>
                  {HAZARD_TYPE_LABELS[type]}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        {validationErrors.hazardType && (
          <p className="mt-1 text-xs text-[var(--color-danger)]">{validationErrors.hazardType}</p>
        )}
      </div>

      {/* Municipalities */}
      <div>
        <p className="text-sm font-medium text-[var(--color-text-secondary)]">
          Affected Municipalities (required)
        </p>
        <p className="mt-1 text-xs text-[var(--color-text-muted)]">
          Select where citizens should see this alert. No barangay selection means the whole
          municipality.
        </p>
        <div
          className="mt-2 grid grid-cols-2 gap-2"
          role="group"
          aria-label="Affected Municipalities"
        >
          {MUNICIPALITIES.map((m) => (
            <label
              key={m.id}
              className="flex cursor-pointer items-center gap-2 rounded border border-white/5 bg-[var(--color-surface)] px-2 py-1.5 text-sm text-[var(--color-text-primary)] hover:bg-white/5"
            >
              <input
                type="checkbox"
                checked={selectedMunicipalityIds.has(m.id)}
                onChange={() => {
                  onToggleMunicipality(m.id)
                }}
                className="h-4 w-4 accent-[var(--color-danger)]"
              />
              <span className="truncate">{m.label}</span>
            </label>
          ))}
        </div>
        {validationErrors.municipalities && (
          <p className="mt-1 text-xs text-[var(--color-danger)]">
            {validationErrors.municipalities}
          </p>
        )}
        <p className="mt-2 text-xs font-medium text-[var(--color-text-primary)]" aria-live="polite">
          {selectedMunicipalitySummary}
        </p>
        {selectedMunicipalityIds.size > 0 && (
          <button
            type="button"
            onClick={() => {
              onSetShowBarangaySelector((s) => !s)
            }}
            className="mt-2 text-xs text-[var(--color-accent)] hover:underline"
            aria-expanded={showBarangaySelector}
          >
            {showBarangaySelector ? 'Hide barangay selector' : 'Specify barangays (advanced)'}
          </button>
        )}
      </div>

      {/* Barangay Selector */}
      {showBarangaySelector && selectedMunicipalityIds.size > 0 && (
        <div className="rounded border border-dashed border-white/10 p-4">
          <p className="mb-2 text-xs text-[var(--color-text-muted)]">
            Barangays in selected municipalities
          </p>
          {Array.from(selectedMunicipalityIds).map((municipalityId) => {
            const barangays = BARANGAYS_BY_MUNICIPALITY[municipalityId] ?? []
            const allSelected =
              barangays.length > 0 && barangays.every((b) => selectedBarangayIds.has(b))
            return (
              <div key={municipalityId} className="mb-3">
                <label className="mb-1 flex items-center gap-2 text-xs font-semibold text-[var(--color-text-secondary)]">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={(e) => {
                      onToggleAllBarangaysForMunicipality(municipalityId, e.target.checked)
                    }}
                    className="h-3.5 w-3.5 accent-[var(--color-danger)]"
                  />
                  Select all barangays in {MUNICIPALITY_ID_TO_LABEL[municipalityId]}
                </label>
                <div className="grid grid-cols-2 gap-1 pl-5 text-xs">
                  {barangays.map((b) => (
                    <label key={b} className="flex items-center gap-1.5">
                      <input
                        type="checkbox"
                        checked={selectedBarangayIds.has(b)}
                        onChange={() => {
                          onToggleBarangay(b)
                        }}
                        className="h-3 w-3 accent-[var(--color-danger)]"
                      />
                      {b}
                    </label>
                  ))}
                </div>
              </div>
            )
          })}
          <p className="text-xs text-[var(--color-text-muted)]">
            Tip: If no barangays are selected, the alert applies to the entire municipality.
          </p>
        </div>
      )}

      {/* Affected Sectors */}
      <div>
        <p className="text-sm font-medium text-[var(--color-text-secondary)]">Affected Sectors</p>
        <div className="mt-2 grid grid-cols-2 gap-2" role="group" aria-label="Affected Sectors">
          {SECTOR_TYPES.filter((s) => s !== 'all').map((sector) => (
            <label
              key={sector}
              className="flex cursor-pointer items-center gap-2 rounded border border-white/5 bg-[var(--color-surface)] px-2 py-1.5 text-sm text-[var(--color-text-primary)] hover:bg-white/5"
            >
              <input
                type="checkbox"
                checked={selectedSectors.has(sector)}
                onChange={() => {
                  onToggleSector(sector)
                }}
                className="h-4 w-4 accent-[var(--color-danger)]"
              />
              <span className="truncate">{SECTOR_LABELS[sector]}</span>
            </label>
          ))}
          <label className="flex cursor-pointer items-center gap-2 rounded border border-white/5 bg-[var(--color-surface)] px-2 py-1.5 text-sm text-[var(--color-text-primary)] hover:bg-white/5">
            <input
              type="checkbox"
              checked={selectedSectors.size === SECTOR_TYPES.filter((s) => s !== 'all').length}
              onChange={() => {
                onToggleSector('all')
              }}
              className="h-4 w-4 accent-[var(--color-danger)]"
            />
            <span className="truncate">{SECTOR_LABELS.all}</span>
          </label>
        </div>
      </div>

      {/* Effective Period */}
      <div>
        <label className="block text-sm font-medium text-[var(--color-text-secondary)]">
          Effective Period
          {REQUIRES_EFFECTIVE_PERIOD.has(hazardType) && (
            <span className="text-[var(--color-danger)]"> *</span>
          )}
        </label>
        <div className="mt-1 grid grid-cols-2 gap-3">
          <div>
            <span className="text-xs text-[var(--color-text-muted)]">From</span>
            <input
              type="datetime-local"
              value={effectiveFrom}
              onChange={(e) => {
                onSetEffectiveFrom(e.target.value)
              }}
              className="w-full rounded border border-white/10 bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-primary)]"
            />
            {validationErrors.effectiveFrom && (
              <p className="mt-1 text-xs text-[var(--color-danger)]">
                {validationErrors.effectiveFrom}
              </p>
            )}
          </div>
          <div>
            <span className="text-xs text-[var(--color-text-muted)]">Until</span>
            <input
              type="datetime-local"
              value={effectiveUntil}
              onChange={(e) => {
                onSetEffectiveUntil(e.target.value)
              }}
              className="w-full rounded border border-white/10 bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-primary)]"
            />
            {validationErrors.effectiveUntil && (
              <p className="mt-1 text-xs text-[var(--color-danger)]">
                {validationErrors.effectiveUntil}
              </p>
            )}
          </div>
        </div>
        {REQUIRES_EFFECTIVE_PERIOD.has(hazardType) && (
          <p className="mt-1 text-xs text-[var(--color-text-muted)]">
            Effective period is required for this alert type.
          </p>
        )}
      </div>

      {/* Expected Resolution */}
      <div>
        <label
          htmlFor="expected-resolution"
          className="block text-sm font-medium text-[var(--color-text-secondary)]"
        >
          Expected Resolution (optional)
        </label>
        <input
          id="expected-resolution"
          type="datetime-local"
          value={expectedResolutionAt}
          onChange={(e) => {
            onSetExpectedResolutionAt(e.target.value)
          }}
          className="mt-1 w-full rounded border border-white/10 bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-primary)]"
        />
        <p className="mt-1 text-xs text-[var(--color-text-muted)]">
          Used for open-ended events (e.g., estimated power restoration or typhoon passage).
        </p>
      </div>

      {/* Road Name */}
      {SHOWS_ROAD_NAME.has(hazardType) && (
        <div>
          <label
            htmlFor="road-name"
            className="block text-sm font-medium text-[var(--color-text-secondary)]"
          >
            Road / Route Name {REQUIRES_EFFECTIVE_PERIOD.has(hazardType) ? '*' : ''}
          </label>
          <input
            id="road-name"
            type="text"
            value={roadName}
            onChange={(e) => {
              onSetRoadName(e.target.value)
            }}
            placeholder="e.g. Maharlika Highway, Daet-Basud Road"
            className="mt-1 w-full rounded border border-white/10 bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)]"
          />
          {validationErrors.roadName && (
            <p className="mt-1 text-xs text-[var(--color-danger)]">{validationErrors.roadName}</p>
          )}
        </div>
      )}

      {/* Message */}
      <div>
        <label
          htmlFor="alert-message"
          className="block text-sm font-medium text-[var(--color-text-secondary)]"
        >
          Message (required)
        </label>
        <textarea
          id="alert-message"
          value={message}
          onChange={(e) => {
            onSetMessage(e.target.value.slice(0, 500))
          }}
          rows={4}
          placeholder="Describe the alert and any immediate advisories..."
          className="mt-1 w-full resize-none rounded border border-white/10 bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)]"
        />
        <div className="mt-1 flex justify-end">
          <span
            className={`text-xs ${
              message.length >= 450
                ? 'text-[var(--color-warning)]'
                : 'text-[var(--color-text-muted)]'
            }`}
          >
            {message.length}/500
          </span>
        </div>
        {validationErrors.message && (
          <p className="mt-1 text-xs text-[var(--color-danger)]">{validationErrors.message}</p>
        )}
      </div>
    </div>
  )
}
