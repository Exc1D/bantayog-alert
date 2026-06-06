import {
  CAMARINES_NORTE_BARANGAYS,
  CAMARINES_NORTE_MUNICIPALITIES,
} from '@bantayog/shared-validators'

export const FALLBACK_BARANGAYS = CAMARINES_NORTE_BARANGAYS

export const MUNICIPALITY_LABELS = Object.fromEntries(
  CAMARINES_NORTE_MUNICIPALITIES.map((m) => [m.id, m.label]),
)

export const MUNI_LABELS_SORTED = [...CAMARINES_NORTE_MUNICIPALITIES]
  .sort((a, b) => a.label.localeCompare(b.label))
  .map((m) => ({ id: m.id, label: m.label }))
