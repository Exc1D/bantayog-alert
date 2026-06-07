import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { useFocusTrap } from '../hooks/useFocusTrap'
import { callables } from '../services/callables'
import {
  buildDeclareAlertPayload,
  defaultSectorsForHazardType,
  SHOWS_ROAD_NAME,
  validateDeclareAlertForm,
} from './declare-alert-form'
import {
  ALLOWED_MUNICIPALITY_IDS,
  BARANGAYS_BY_MUNICIPALITY,
  MUNICIPALITIES,
  HAZARD_TYPE_LABELS,
  SECTOR_TYPES,
  formatShortList,
} from './declare-alert-options'
import type { DeclareAlertValidationErrors } from './declare-alert-form'

export interface UseDeclareAlertOptions {
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

export interface UseDeclareAlertReturn {
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
  submitting: boolean
  showUnsavedWarning: boolean
  showSubmitConfirm: boolean
  submitError: string | null
  dialogRef: React.RefObject<HTMLDivElement | null>
  trapRef: React.RefObject<HTMLDivElement | null>
  validationErrors: DeclareAlertValidationErrors
  isValid: boolean
  hasUnsavedChanges: boolean
  handleHazardTypeChange: (type: string) => void
  toggleMunicipality: (id: string) => void
  toggleBarangay: (barangay: string) => void
  toggleAllBarangaysForMunicipality: (municipalityId: string, checked: boolean) => void
  toggleSector: (sector: string) => void
  setShowBarangaySelector: (value: boolean | ((prev: boolean) => boolean)) => void
  setEffectiveFrom: (value: string) => void
  setEffectiveUntil: (value: string) => void
  setExpectedResolutionAt: (value: string) => void
  setRoadName: (value: string) => void
  setMessage: (value: string) => void
  handleRequestClose: () => void
  handleBackdropClick: (e: React.MouseEvent<HTMLDivElement>) => void
  handleReviewSubmit: () => void
  handleSubmit: () => Promise<void>
  setShowUnsavedWarning: (value: boolean) => void
  setShowSubmitConfirm: (value: boolean) => void
  alertTypeLabel: string
  selectedMunicipalityLabels: string[]
  selectedMunicipalitySummary: string
}

export function useDeclareAlert(options: UseDeclareAlertOptions): UseDeclareAlertReturn {
  const { open, prefill, onClose, onSuccess, onError } = options

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
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const dialogRef = useRef<HTMLDivElement>(null)

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
    setShowSubmitConfirm(false)
    setSubmitError(null)
    setShowBarangaySelector(false)
    setSelectedBarangayIds(new Set())
    setSelectedSectors(new Set())
    setEffectiveFrom('')
    setEffectiveUntil('')
    setExpectedResolutionAt('')
    setRoadName('')
    const next = new Set<string>()
    if (prefill?.municipalityId) {
      if (ALLOWED_MUNICIPALITY_IDS.has(prefill.municipalityId)) {
        next.add(prefill.municipalityId)
      }
    }
    setSelectedMunicipalityIds(next)
  }, [open, prefill?.municipalityId])
  /* eslint-enable react-hooks/set-state-in-effect */

  const handleHazardTypeChange = useCallback((type: string) => {
    setHazardType(type)
    setSelectedSectors(defaultSectorsForHazardType(type))
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
    if (showSubmitConfirm) {
      setShowSubmitConfirm(false)
      return
    }
    if (hasUnsavedChanges) {
      setShowUnsavedWarning(true)
      return
    }
    onClose()
  }, [submitting, showSubmitConfirm, hasUnsavedChanges, onClose])

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.target === e.currentTarget) {
        handleRequestClose()
      }
    },
    [handleRequestClose],
  )

  const validationErrors = useMemo(() => {
    return validateDeclareAlertForm({
      hazardType,
      selectedMunicipalityIds,
      message,
      effectiveFrom,
      effectiveUntil,
      roadName,
    })
  }, [hazardType, selectedMunicipalityIds, effectiveFrom, effectiveUntil, roadName, message])

  const isValid = Object.keys(validationErrors).length === 0

  const handleReviewSubmit = useCallback(() => {
    if (!isValid) return
    setSubmitError(null)
    setShowSubmitConfirm(true)
  }, [isValid])

  const handleSubmit = useCallback(async () => {
    if (!isValid) return
    setSubmitError(null)
    setSubmitting(true)
    try {
      const payload = buildDeclareAlertPayload({
        hazardType,
        selectedMunicipalityIds,
        message,
        effectiveFrom,
        effectiveUntil,
        expectedResolutionAt,
        selectedSectors,
        selectedBarangayIds,
        roadName,
        reportId: prefill?.reportId,
      })
      const result = await callables.declareAlert(payload)
      onSuccess(result.alertId)
      onClose()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to declare alert'
      setSubmitError(`Alert was not declared. ${msg}`)
      setShowSubmitConfirm(false)
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

  const trapRef = useFocusTrap({
    isActive: open,
    onEscape: () => {
      if (submitting || showUnsavedWarning) return
      if (showSubmitConfirm) {
        setShowSubmitConfirm(false)
        return
      }
      onClose()
    },
  })

  const selectedMunicipalityLabels = useMemo(
    () => MUNICIPALITIES.filter((m) => selectedMunicipalityIds.has(m.id)).map((m) => m.label),
    [selectedMunicipalityIds],
  )
  const selectedMunicipalitySummary =
    selectedMunicipalityLabels.length > 0
      ? `Selected municipalities: ${formatShortList(selectedMunicipalityLabels)}`
      : 'Selected municipalities: none'
  const alertTypeLabel = hazardType
    ? (HAZARD_TYPE_LABELS[hazardType] ?? hazardType)
    : 'None selected'

  return {
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
    submitting,
    showUnsavedWarning,
    showSubmitConfirm,
    submitError,
    dialogRef,
    trapRef,
    validationErrors,
    isValid,
    hasUnsavedChanges,
    handleHazardTypeChange,
    toggleMunicipality,
    toggleBarangay,
    toggleAllBarangaysForMunicipality,
    toggleSector,
    setShowBarangaySelector,
    setEffectiveFrom,
    setEffectiveUntil,
    setExpectedResolutionAt,
    setRoadName,
    setMessage,
    handleRequestClose,
    handleBackdropClick,
    handleReviewSubmit,
    handleSubmit,
    setShowUnsavedWarning,
    setShowSubmitConfirm,
    alertTypeLabel,
    selectedMunicipalityLabels,
    selectedMunicipalitySummary,
  }
}
