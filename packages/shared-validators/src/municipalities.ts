import { z } from 'zod'

export const mdrrmoLabelSchema = z.string().min(1).max(80)
export const MDRRMO_HOTLINE_REGEX = /^[+\d(][\d\s\-()]{6,20}$/
export const mdrrmoHotlineSchema = z.string().regex(MDRRMO_HOTLINE_REGEX)

export const municipalityDocSchema = z
  .object({
    id: z.string().min(1).max(32),
    label: z.string().min(1).max(64),
    provinceId: z.string().min(1).max(32),
    centroid: z
      .object({
        lat: z.number(),
        lng: z.number(),
      })
      .strict(),
    // Per-jurisdiction MDRRMO contact info shown to citizens after submission.
    // Optional so legacy seed docs validate; consumers must fall back to a
    // project-wide default when absent.
    mdrrmoLabel: mdrrmoLabelSchema.optional(),
    mdrrmoHotline: mdrrmoHotlineSchema.optional(),
    // Audit trail written by the updateMunicipalityContact callable.
    contactUpdatedAt: z.number().int().positive().optional(),
    contactUpdatedBy: z.string().min(1).max(128).optional(),
    schemaVersion: z.number().int().positive(),
  })
  .strict()

export type MunicipalityDoc = z.infer<typeof municipalityDocSchema>

// Seed constant for the Phase 3 pilot province.
export const CAMARINES_NORTE_MUNICIPALITIES: readonly Omit<MunicipalityDoc, 'schemaVersion'>[] = [
  {
    id: 'daet',
    label: 'Daet',
    provinceId: 'camarines-norte',
    centroid: { lat: 14.1121, lng: 122.9554 },
    mdrrmoLabel: 'Daet MDRRMO',
    mdrrmoHotline: '(054) 721-1216',
  },
  {
    id: 'basud',
    label: 'Basud',
    provinceId: 'camarines-norte',
    centroid: { lat: 14.0661, lng: 122.9561 },
  },
  {
    id: 'capalonga',
    label: 'Capalonga',
    provinceId: 'camarines-norte',
    centroid: { lat: 14.3339, lng: 122.504 },
  },
  {
    id: 'jose-panganiban',
    label: 'Jose Panganiban',
    provinceId: 'camarines-norte',
    centroid: { lat: 14.293, lng: 122.69 },
  },
  {
    id: 'labo',
    label: 'Labo',
    provinceId: 'camarines-norte',
    centroid: { lat: 14.157, lng: 122.83 },
  },
  {
    id: 'mercedes',
    label: 'Mercedes',
    provinceId: 'camarines-norte',
    centroid: { lat: 14.1061, lng: 123.0125 },
  },
  {
    id: 'paracale',
    label: 'Paracale',
    provinceId: 'camarines-norte',
    centroid: { lat: 14.284, lng: 122.786 },
  },
  {
    id: 'san-lorenzo-ruiz',
    label: 'San Lorenzo Ruiz',
    provinceId: 'camarines-norte',
    centroid: { lat: 14.132, lng: 122.76 },
  },
  {
    id: 'san-vicente',
    label: 'San Vicente',
    provinceId: 'camarines-norte',
    centroid: { lat: 14.098, lng: 122.876 },
  },
  {
    id: 'santa-elena',
    label: 'Santa Elena',
    provinceId: 'camarines-norte',
    centroid: { lat: 14.213, lng: 122.381 },
  },
  {
    id: 'talisay',
    label: 'Talisay',
    provinceId: 'camarines-norte',
    centroid: { lat: 14.137, lng: 122.922 },
  },
  {
    id: 'vinzons',
    label: 'Vinzons',
    provinceId: 'camarines-norte',
    centroid: { lat: 14.172, lng: 122.908 },
  },
]

const MUNICIPALITY_ID_SET = new Set(CAMARINES_NORTE_MUNICIPALITIES.map((m) => m.id))

/**
 * Payload for the updateMunicipalityContact callable. Both fields are required:
 * the edit form prefills both, and a label without a hotline is meaningless to
 * the citizen-facing contact card. municipalityId must be a known jurisdiction.
 */
export const updateMunicipalityContactInputSchema = z
  .object({
    municipalityId: z.string().refine((id) => MUNICIPALITY_ID_SET.has(id), {
      message: 'unknown municipality',
    }),
    mdrrmoLabel: mdrrmoLabelSchema,
    mdrrmoHotline: mdrrmoHotlineSchema,
  })
  .strict()

export type UpdateMunicipalityContactInput = z.infer<typeof updateMunicipalityContactInputSchema>
