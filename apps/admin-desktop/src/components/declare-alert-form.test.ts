import { describe, expect, it } from 'vitest'
import {
  buildDeclareAlertPayload,
  defaultSectorsForHazardType,
  validateDeclareAlertForm,
} from './declare-alert-form'

describe('declare alert form policy', () => {
  it('defaults class suspension sectors to schools', () => {
    expect(Array.from(defaultSectorsForHazardType('class_suspension'))).toEqual([
      'public_schools',
      'private_schools',
    ])
  })

  it('validates required fields and ordered effective period', () => {
    expect(
      validateDeclareAlertForm({
        hazardType: 'class_suspension',
        selectedMunicipalityIds: new Set(['daet']),
        message: 'Classes are suspended.',
        effectiveFrom: '2026-06-06T10:00',
        effectiveUntil: '2026-06-06T09:00',
        roadName: '',
      }),
    ).toEqual({
      effectiveUntil: 'End time must be after start time',
    })
  })

  it('builds a trimmed callable payload and omits empty optional fields', () => {
    expect(
      buildDeclareAlertPayload({
        hazardType: 'flood_advisory',
        selectedMunicipalityIds: new Set(['daet']),
        message: '  Floodwaters are rising.  ',
        effectiveFrom: '',
        effectiveUntil: '',
        expectedResolutionAt: '',
        selectedSectors: new Set(),
        selectedBarangayIds: new Set(),
        roadName: '  ',
        reportId: undefined,
      }),
    ).toEqual({
      hazardType: 'flood_advisory',
      affectedMunicipalityIds: ['daet'],
      message: 'Floodwaters are rising.',
    })
  })
})
