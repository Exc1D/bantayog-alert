import { useState, useMemo, useCallback } from 'react'
import { CAMARINES_NORTE_MUNICIPALITIES } from '@bantayog/shared-validators'
import { FALLBACK_BARANGAYS } from '../data/fallback-barangays'

const MUNICIPALITY_LABELS = Object.fromEntries(
  CAMARINES_NORTE_MUNICIPALITIES.map((m) => [m.id, m.label]),
)

const MUNI_LABELS_SORTED = [...CAMARINES_NORTE_MUNICIPALITIES]
  .sort((a, b) => a.label.localeCompare(b.label))
  .map((m) => ({ id: m.id, label: m.label }))

const VALID_MUNICIPALITY_IDS = new Set(CAMARINES_NORTE_MUNICIPALITIES.map((m) => m.id))

export interface UseMunicipalityBarangaysResult {
  selectedMunicipalityId: string
  selectedBarangayId: string | undefined
  barangayOptions: { name: string; municipality: string }[]
  municipalityOptions: { id: string; label: string }[]
  handleSelectMunicipality: (muniId: string) => void
  handleSelectBarangay: (id: string | undefined) => void
  reset: () => void
}

export function useMunicipalityBarangays(): UseMunicipalityBarangaysResult {
  const [selectedMunicipalityId, setSelectedMunicipalityId] = useState('')
  const [selectedBarangayId, setSelectedBarangayId] = useState<string | undefined>(undefined)

  const barangayOptions = useMemo(() => {
    if (!selectedMunicipalityId) return []
    return FALLBACK_BARANGAYS.filter(
      (b) => MUNICIPALITY_LABELS[selectedMunicipalityId] === b.municipality,
    ).sort((a, b) => a.name.localeCompare(b.name))
  }, [selectedMunicipalityId])

  const handleSelectMunicipality = useCallback((muniId: string) => {
    if (!muniId) {
      setSelectedMunicipalityId('')
      setSelectedBarangayId(undefined)
      return
    }
    if (!VALID_MUNICIPALITY_IDS.has(muniId)) {
      return
    }
    setSelectedMunicipalityId(muniId)
    setSelectedBarangayId(undefined)
  }, [])

  const handleSelectBarangay = useCallback(
    (id: string | undefined) => {
      if (id === undefined) {
        setSelectedBarangayId(undefined)
        return
      }
      if (barangayOptions.some((b) => b.name === id)) {
        setSelectedBarangayId(id)
      }
    },
    [barangayOptions],
  )

  const reset = useCallback(() => {
    setSelectedMunicipalityId('')
    setSelectedBarangayId(undefined)
  }, [])

  return {
    selectedMunicipalityId,
    selectedBarangayId,
    barangayOptions,
    municipalityOptions: MUNI_LABELS_SORTED,
    handleSelectMunicipality,
    handleSelectBarangay,
    reset,
  }
}
