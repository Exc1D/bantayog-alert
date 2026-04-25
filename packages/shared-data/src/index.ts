// Dataset loader filled in Phase 2 after barangay boundary dataset is
// sourced (licensing cleared) and uploaded to Cloud Storage per design
// spec §11.1. Phase 0 delivers only the package structure.

/**

12 Camarines Norte municipalities — used by analytics snapshot writer and
mass-alert scope validation.
*/
export const CAMARINES_NORTE_MUNICIPALITY_IDS = [
  'basud',
  'capalonga',
  'daet',
  'san_lorenzo_ruiz',
  'jose_panganiban',
  'labo',
  'mercedes',
  'paracale',
  'san_vicente',
  'santa_elena',
  'talisay',
  'vinzons',
] as const

export type CamarinesNorteMunicipalityId = (typeof CAMARINES_NORTE_MUNICIPALITY_IDS)[number]
