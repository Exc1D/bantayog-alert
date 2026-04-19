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
    defaultSmsLocale: z.enum(['tl', 'en']).optional(),
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
    defaultSmsLocale: 'tl',
  },
  {
    id: 'basud',
    label: 'Basud',
    provinceId: 'camarines-norte',
    centroid: { lat: 14.0661, lng: 122.9561 },
    defaultSmsLocale: 'tl',
  },
  {
    id: 'capalonga',
    label: 'Capalonga',
    provinceId: 'camarines-norte',
    centroid: { lat: 14.3339, lng: 122.504 },
    defaultSmsLocale: 'tl',
  },
  {
    id: 'jose-panganiban',
    label: 'Jose Panganiban',
    provinceId: 'camarines-norte',
    centroid: { lat: 14.293, lng: 122.69 },
    defaultSmsLocale: 'tl',
  },
  {
    id: 'labo',
    label: 'Labo',
    provinceId: 'camarines-norte',
    centroid: { lat: 14.157, lng: 122.83 },
    defaultSmsLocale: 'tl',
  },
  {
    id: 'mercedes',
    label: 'Mercedes',
    provinceId: 'camarines-norte',
    centroid: { lat: 14.1061, lng: 123.0125 },
    defaultSmsLocale: 'tl',
  },
  {
    id: 'paracale',
    label: 'Paracale',
    provinceId: 'camarines-norte',
    centroid: { lat: 14.284, lng: 122.786 },
    defaultSmsLocale: 'tl',
  },
  {
    id: 'san-lorenzo-ruiz',
    label: 'San Lorenzo Ruiz',
    provinceId: 'camarines-norte',
    centroid: { lat: 14.132, lng: 122.76 },
    defaultSmsLocale: 'tl',
  },
  {
    id: 'san-vicente',
    label: 'San Vicente',
    provinceId: 'camarines-norte',
    centroid: { lat: 14.098, lng: 122.876 },
    defaultSmsLocale: 'tl',
  },
  {
    id: 'santa-elena',
    label: 'Santa Elena',
    provinceId: 'camarines-norte',
    centroid: { lat: 14.213, lng: 122.381 },
    defaultSmsLocale: 'tl',
  },
  {
    id: 'talisay',
    label: 'Talisay',
    provinceId: 'camarines-norte',
    centroid: { lat: 14.137, lng: 122.922 },
    defaultSmsLocale: 'tl',
  },
  {
    id: 'vinzons',
    label: 'Vinzons',
    provinceId: 'camarines-norte',
    centroid: { lat: 14.172, lng: 122.908 },
    defaultSmsLocale: 'tl',
  },
]
