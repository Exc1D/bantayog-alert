import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { X, AlertTriangle } from 'lucide-react'
import { useFocusTrap } from '../hooks/useFocusTrap'
import { callables } from '../services/callables'
import { CAMARINES_NORTE_MUNICIPALITIES } from '@bantayog/shared-validators'
import { getBarangayGazetteer } from '@bantayog/shared-sms-parser'

// Map municipality ID to label
const MUNICIPALITY_ID_TO_LABEL = Object.fromEntries(
  CAMARINES_NORTE_MUNICIPALITIES.map((m) => [m.id, m.label]),
)

// Map municipality label to ID
const MUNICIPALITY_LABEL_TO_ID = Object.fromEntries(
  CAMARINES_NORTE_MUNICIPALITIES.map((m) => [m.label, m.id]),
)

// Build barangays by municipality ID
const BARANGAYS_BY_MUNICIPALITY: Record<string, string[]> = {}
const gazetteer = getBarangayGazetteer()
for (const b of gazetteer) {
  const municipalityId = MUNICIPALITY_LABEL_TO_ID[b.municipality]
  if (municipalityId) {
    BARANGAYS_BY_MUNICIPALITY[municipalityId] ??= []
    BARANGAYS_BY_MUNICIPALITY[municipalityId].push(b.name)
  }
}

// Hazard type labels
const HAZARD_TYPE_LABELS: Record<string, string> = {
  tropical_cyclone: 'Tropical Cyclone (Typhoon)',
  heavy_rainfall_warning: 'Heavy Rainfall Warning',
  thunderstorm_advisory: 'Thunderstorm Advisory',
  flood_advisory: 'Flood Advisory / Warning',
  storm_surge_warning: 'Storm Surge Warning',
  gale_warning: 'Gale Warning',
  heat_index_warning: 'Heat Index Warning',
  cold_surge_advisory: 'Cold Surge Advisory',
  earthquake: 'Earthquake',
  volcanic_eruption: 'Volcanic Eruption / Activity',
  landslide: 'Landslide',
  tsunami_warning: 'Tsunami Warning',
  drought: 'Drought / Dry Spell',
  fire: 'Fire — Structural / Forest / Grass',
  scheduled_power_interruption: 'Scheduled Power Interruption',
  emergency_power_interruption: 'Emergency Power Interruption',
  water_service_interruption: 'Water Service Interruption',
  road_closure: 'Road Closure',
  bridge_closure: 'Bridge Closure',
  telecommunication_outage: 'Telecommunication Outage',
  structural_damage: 'Structural / Building Damage',
  class_suspension: 'Class Suspension',
  work_suspension: 'Work Suspension',
  transport_suspension: 'Transport Suspension',
  curfew: 'Curfew',
  state_of_calamity: 'State of Calamity',
  preemptive_evacuation: 'Pre-emptive Evacuation',
  evacuation_order: 'Evacuation Order',
  security_incident: 'Security Incident',
  crime_alert: 'Crime Alert',
  health_advisory: 'Health Advisory',
  disease_outbreak: 'Disease Outbreak / Epidemic Alert',
  other: 'Other — specify in message',
}

const HAZARD_GROUPS = [
  {
    label: '🌧️ Weather & Flood',
    types: [
      'tropical_cyclone',
      'heavy_rainfall_warning',
      'thunderstorm_advisory',
      'flood_advisory',
      'storm_surge_warning',
      'gale_warning',
      'heat_index_warning',
      'cold_surge_advisory',
    ],
  },
  {
    label: '🌋 Geophysical & Natural',
    types: ['earthquake', 'volcanic_eruption', 'landslide', 'tsunami_warning', 'drought', 'fire'],
  },
  {
    label: '🔌 Utilities & Infrastructure',
    types: [
      'scheduled_power_interruption',
      'emergency_power_interruption',
      'water_service_interruption',
      'road_closure',
      'bridge_closure',
      'telecommunication_outage',
      'structural_damage',
    ],
  },
  {
    label: '📋 Public Service Orders',
    types: [
      'class_suspension',
      'work_suspension',
      'transport_suspension',
      'curfew',
      'state_of_calamity',
      'preemptive_evacuation',
      'evacuation_order',
    ],
  },
  {
    label: '🛡️ Security & Health',
    types: ['security_incident', 'crime_alert', 'health_advisory', 'disease_outbreak'],
  },
  { label: '⚪ Other', types: ['other'] },
]

const SECTOR_LABELS: Record<string, string> = {
  public_schools: 'Public Schools',
  private_schools: 'Private Schools',
  government_offices: 'Government Offices',
  private_business: 'Private Business',
  healthcare: 'Healthcare',
  transportation: 'Transportation',
  all: 'All Sectors',
}

const SECTOR_TYPES = Object.keys(SECTOR_LABELS)

const REQUIRES_EFFECTIVE_PERIOD = new Set([
  'scheduled_power_interruption',
  'class_suspension',
  'work_suspension',
  'transport_suspension',
  'curfew',
])

const SHOWS_ROAD_NAME = new Set(['road_closure', 'bridge_closure'])

interface Props {
  open: boolean
  prefill?:
    | {
        municipalityId: string | undefined
        reportId: string | undefined
      }
    | undefined
  onClose: () => void
  onSuccess: (alertId: string) => void
  onError: (message: string) => void
}

export function DeclareAlertModal({ open, prefill, onClose, onSuccess, onError }: Props) {
  const [hazardType, setHazardType] = useState('')
  const [selectedMunicipalityIds, setSelectedMunicipalityIds] = useState<Set<string>>(new Set())
  const [showBarangaySelector, setShowBarangaySelector] = useState(false)
  const [selectedBarangayIds, setSelectedBarangayIds] = useState<Set<string>>(new Set())
  const [selectedSectors, setSelectedSectors] = useState<Set<string>>(new Set())
  const [effectiveFrom, setEffectiveFrom] = useState('')
  const [effectiveUntil, setEffectiveUntil] = useState('')
  const [expectedResolutionAt, setExpectedResolutionAt] = useState('')
  const [roadName, setRoadName] = useState('')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [showUnsavedWarning, setShowUnsavedWarning] = useState(false)
  const dialogRef = useRef<HTMLDivElement>(null)
  const trapRef = useFocusTrap({
    isActive: open,
    onEscape: () => {
      if (!submitting && !showUnsavedWarning) onClose()
    },
  })

  const hasUnsavedChanges =
    hazardType !== '' ||
    selectedMunicipalityIds.size > 0 ||
    message.trim().length > 0 ||
    effectiveFrom !== '' ||
    effectiveUntil !== '' ||
    expectedResolutionAt !== '' ||
    roadName.trim().length > 0 ||
    selectedSectors.size > 0 ||
    selectedBarangayIds.size > 0

  // Warn before closing browser tab with unsaved changes
  useEffect(() => {
    if (!hasUnsavedChanges) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      // Legacy browsers require returnValue assignment; modern browsers ignore it.
      // This is the spec-compliant way to trigger the native confirmation dialog.
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => {
      window.removeEventListener('beforeunload', handler)
    }
  }, [hasUnsavedChanges])

  // Reset and prefill when opened
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!open) return
    setHazardType('')
    setMessage('')
    setSubmitting(false)
    setShowUnsavedWarning(false)
    setShowBarangaySelector(false)
    setSelectedBarangayIds(new Set())
    setSelectedSectors(new Set())
    setEffectiveFrom('')
    setEffectiveUntil('')
    setExpectedResolutionAt('')
    setRoadName('')
    const next = new Set<string>()
    if (prefill?.municipalityId) {
      const allowedIds = new Set(CAMARINES_NORTE_MUNICIPALITIES.map((m) => m.id))
      if (allowedIds.has(prefill.municipalityId)) {
        next.add(prefill.municipalityId)
      }
    }
    setSelectedMunicipalityIds(next)
  }, [open, prefill?.municipalityId])
  /* eslint-enable react-hooks/set-state-in-effect */

  const handleHazardTypeChange = useCallback((type: string) => {
    setHazardType(type)
    if (type === 'class_suspension') {
      setSelectedSectors(new Set(['public_schools', 'private_schools']))
    } else if (type === 'work_suspension') {
      setSelectedSectors(new Set(['government_offices', 'private_business']))
    } else {
      setSelectedSectors(new Set())
    }
    if (!SHOWS_ROAD_NAME.has(type)) {
      setRoadName('')
    }
  }, [])

  const toggleMunicipality = useCallback((id: string) => {
    setSelectedMunicipalityIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
        setSelectedBarangayIds((barangays) => {
          const nextBarangays = new Set(barangays)
          const municipalityBarangays = BARANGAYS_BY_MUNICIPALITY[id] ?? []
          for (const b of municipalityBarangays) {
            nextBarangays.delete(b)
          }
          return nextBarangays
        })
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  const toggleBarangay = useCallback((barangay: string) => {
    setSelectedBarangayIds((prev) => {
      const next = new Set(prev)
      if (next.has(barangay)) next.delete(barangay)
      else next.add(barangay)
      return next
    })
  }, [])

  const toggleAllBarangaysForMunicipality = useCallback(
    (municipalityId: string, checked: boolean) => {
      const barangays = BARANGAYS_BY_MUNICIPALITY[municipalityId] ?? []
      setSelectedBarangayIds((prev) => {
        const next = new Set(prev)
        for (const b of barangays) {
          if (checked) next.add(b)
          else next.delete(b)
        }
        return next
      })
    },
    [],
  )

  const toggleSector = useCallback((sector: string) => {
    setSelectedSectors((prev) => {
      const next = new Set(prev)
      if (sector === 'all') {
        return prev.size > 0 ? new Set() : new Set(SECTOR_TYPES.filter((s) => s !== 'all'))
      }
      if (next.has(sector)) next.delete(sector)
      else next.add(sector)
      next.delete('all')
      return next
    })
  }, [])

  const handleRequestClose = useCallback(() => {
    if (submitting) return
    if (hasUnsavedChanges) {
      setShowUnsavedWarning(true)
      return
    }
    onClose()
  }, [submitting, hasUnsavedChanges, onClose])

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.target === e.currentTarget) {
        handleRequestClose()
      }
    },
    [handleRequestClose],
  )

  const validationErrors = useMemo(() => {
    const errors: Record<string, string> = {}
    if (!hazardType) errors.hazardType = 'Select an alert type'
    if (selectedMunicipalityIds.size === 0)
      errors.municipalities = 'Select at least one municipality'
    if (REQUIRES_EFFECTIVE_PERIOD.has(hazardType)) {
      if (!effectiveFrom) errors.effectiveFrom = 'Start time is required for this alert type'
      if (!effectiveUntil) errors.effectiveUntil = 'End time is required for this alert type'
    }
    if (effectiveFrom && effectiveUntil) {
      if (new Date(effectiveUntil).getTime() <= new Date(effectiveFrom).getTime()) {
        errors.effectiveUntil = 'End time must be after start time'
      }
    }
    if (SHOWS_ROAD_NAME.has(hazardType) && !roadName.trim()) {
      errors.roadName = 'Road name is required for this alert type'
    }
    if (!message.trim()) errors.message = 'Message is required'
    return errors
  }, [hazardType, selectedMunicipalityIds.size, effectiveFrom, effectiveUntil, roadName, message])

  const isValid = Object.keys(validationErrors).length === 0

  const handleSubmit = useCallback(async () => {
    if (!isValid) return
    setSubmitting(true)
    try {
      const payload = {
        hazardType,
        affectedMunicipalityIds: Array.from(selectedMunicipalityIds),
        message: message.trim(),
        ...(prefill?.reportId ? { reportId: prefill.reportId } : {}),
        ...(effectiveFrom ? { effectiveFrom: new Date(effectiveFrom).getTime() } : {}),
        ...(effectiveUntil ? { effectiveUntil: new Date(effectiveUntil).getTime() } : {}),
        ...(expectedResolutionAt
          ? { expectedResolutionAt: new Date(expectedResolutionAt).getTime() }
          : {}),
        ...(selectedSectors.size > 0 ? { affectedSectors: Array.from(selectedSectors) } : {}),
        ...(selectedBarangayIds.size > 0
          ? { affectedBarangayIds: Array.from(selectedBarangayIds) }
          : {}),
        ...(roadName.trim() ? { roadName: roadName.trim() } : {}),
      }
      const result = await callables.declareAlert(payload)
      onSuccess(result.alertId)
      onClose()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to declare alert'
      onError(msg)
    } finally {
      setSubmitting(false)
    }
  }, [
    hazardType,
    selectedMunicipalityIds,
    message,
    prefill,
    effectiveFrom,
    effectiveUntil,
    expectedResolutionAt,
    selectedSectors,
    selectedBarangayIds,
    roadName,
    onSuccess,
    onError,
    onClose,
    isValid,
  ])

  if (!open) return null

  return (
    <div
      ref={trapRef}
      className="fixed inset-0 z-[1100] flex items-center justify-center bg-[var(--color-surface)]/80"
      role="presentation"
      onClick={handleBackdropClick}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="declare-alert-title"
        className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-lg border border-white/10 bg-[var(--color-surface-elevated)] shadow-xl"
      >
        <div className="flex items-start justify-between border-b border-white/10 p-6">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-[var(--color-danger)]" />
            <h2
              id="declare-alert-title"
              className="text-lg font-semibold text-[var(--color-text-primary)]"
            >
              Declare Alert
            </h2>
          </div>
          <button
            onClick={handleRequestClose}
            disabled={submitting}
            className="rounded p-1 hover:bg-white/10 disabled:opacity-50"
            aria-label="Close"
          >
            <X className="h-4 w-4 text-[var(--color-text-secondary)]" />
          </button>
        </div>

        <form
          className="flex flex-1 flex-col overflow-hidden"
          onSubmit={(e) => {
            e.preventDefault()
            void handleSubmit()
          }}
        >
          <div className="flex-1 overflow-y-auto p-6">
            <div className="space-y-5">
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
                    handleHazardTypeChange(e.target.value)
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
                  <p className="mt-1 text-xs text-[var(--color-danger)]">
                    {validationErrors.hazardType}
                  </p>
                )}
              </div>

              {/* Municipalities */}
              <div>
                <p className="text-sm font-medium text-[var(--color-text-secondary)]">
                  Affected Municipalities (required)
                </p>
                <div
                  className="mt-2 grid grid-cols-2 gap-2"
                  role="group"
                  aria-label="Affected Municipalities"
                >
                  {CAMARINES_NORTE_MUNICIPALITIES.map((m) => (
                    <label
                      key={m.id}
                      className="flex cursor-pointer items-center gap-2 rounded border border-white/5 bg-[var(--color-surface)] px-2 py-1.5 text-sm text-[var(--color-text-primary)] hover:bg-white/5"
                    >
                      <input
                        type="checkbox"
                        checked={selectedMunicipalityIds.has(m.id)}
                        onChange={() => {
                          toggleMunicipality(m.id)
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
                {selectedMunicipalityIds.size > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowBarangaySelector((s) => !s)
                    }}
                    className="mt-2 text-xs text-[var(--color-accent)] hover:underline"
                    aria-expanded={showBarangaySelector}
                  >
                    {showBarangaySelector
                      ? '− Hide barangay selector'
                      : '+ Specify barangays (advanced)'}
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
                              toggleAllBarangaysForMunicipality(municipalityId, e.target.checked)
                            }}
                            className="h-3.5 w-3.5 accent-[var(--color-danger)]"
                          />
                          {MUNICIPALITY_ID_TO_LABEL[municipalityId]} — select all barangays
                        </label>
                        <div className="grid grid-cols-2 gap-1 pl-5 text-xs">
                          {barangays.map((b) => (
                            <label key={b} className="flex items-center gap-1.5">
                              <input
                                type="checkbox"
                                checked={selectedBarangayIds.has(b)}
                                onChange={() => {
                                  toggleBarangay(b)
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
                <p className="text-sm font-medium text-[var(--color-text-secondary)]">
                  Affected Sectors
                </p>
                <div
                  className="mt-2 grid grid-cols-2 gap-2"
                  role="group"
                  aria-label="Affected Sectors"
                >
                  {SECTOR_TYPES.filter((s) => s !== 'all').map((sector) => (
                    <label
                      key={sector}
                      className="flex cursor-pointer items-center gap-2 rounded border border-white/5 bg-[var(--color-surface)] px-2 py-1.5 text-sm text-[var(--color-text-primary)] hover:bg-white/5"
                    >
                      <input
                        type="checkbox"
                        checked={selectedSectors.has(sector)}
                        onChange={() => {
                          toggleSector(sector)
                        }}
                        className="h-4 w-4 accent-[var(--color-danger)]"
                      />
                      <span className="truncate">{SECTOR_LABELS[sector]}</span>
                    </label>
                  ))}
                  <label className="flex cursor-pointer items-center gap-2 rounded border border-white/5 bg-[var(--color-surface)] px-2 py-1.5 text-sm text-[var(--color-text-primary)] hover:bg-white/5">
                    <input
                      type="checkbox"
                      checked={
                        selectedSectors.size === SECTOR_TYPES.filter((s) => s !== 'all').length
                      }
                      onChange={() => {
                        toggleSector('all')
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
                        setEffectiveFrom(e.target.value)
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
                        setEffectiveUntil(e.target.value)
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
                    setExpectedResolutionAt(e.target.value)
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
                      setRoadName(e.target.value)
                    }}
                    placeholder="e.g. Maharlika Highway, Daet-Basud Road"
                    className="mt-1 w-full rounded border border-white/10 bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)]"
                  />
                  {validationErrors.roadName && (
                    <p className="mt-1 text-xs text-[var(--color-danger)]">
                      {validationErrors.roadName}
                    </p>
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
                    setMessage(e.target.value.slice(0, 500))
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
                  <p className="mt-1 text-xs text-[var(--color-danger)]">
                    {validationErrors.message}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 border-t border-white/10 p-6">
            <button
              type="button"
              onClick={handleRequestClose}
              disabled={submitting}
              className="rounded-md px-4 py-2 text-sm text-[var(--color-text-secondary)] hover:bg-white/10 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!isValid || submitting}
              className="flex items-center gap-2 rounded-md bg-[var(--color-danger)] px-4 py-2 text-sm text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-danger)]"
            >
              {submitting && (
                <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              )}
              Declare Alert
            </button>
          </div>
        </form>
      </div>
      {showUnsavedWarning && (
        <div
          className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/60"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowUnsavedWarning(false)
          }}
        >
          <div
            className="w-full max-w-sm rounded-lg border border-white/10 bg-[var(--color-surface-elevated)] p-6 shadow-xl"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="unsaved-title"
          >
            <h2
              id="unsaved-title"
              className="text-lg font-semibold text-[var(--color-text-primary)]"
            >
              Unsaved Changes
            </h2>
            <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
              You have unsaved changes in this alert form. Closing will discard them.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowUnsavedWarning(false)
                }}
                className="rounded-md px-4 py-2 text-sm text-[var(--color-text-secondary)] hover:bg-white/10"
              >
                Keep Editing
              </button>
              <button
                onClick={() => {
                  setShowUnsavedWarning(false)
                  onClose()
                }}
                className="rounded-md bg-[var(--color-danger)] px-4 py-2 text-sm text-white hover:opacity-90"
              >
                Discard Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
