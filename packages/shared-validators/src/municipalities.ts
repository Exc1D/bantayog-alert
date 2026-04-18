import { z } from 'zod'

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
