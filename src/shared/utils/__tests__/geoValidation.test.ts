import { describe, it, expect } from 'vitest'
import { isValidPHCoordinate, isWithinCamarinesNorte, PH_BOUNDS, CAMARINES_NORTE_BOUNDS } from '../geoValidation'

describe('isValidPHCoordinate', () => {
  it('rejects (0,0)', () => expect(isValidPHCoordinate(0, 0)).toBe(false))

  it('rejects out of PH', () => expect(isValidPHCoordinate(40.0, -74.0)).toBe(false))

  it('accepts Daet center', () => expect(isValidPHCoordinate(14.1129, 122.9550)).toBe(true))

  it('rejects lat > 90', () => expect(isValidPHCoordinate(91, 122)).toBe(false))

  it('rejects non-finite lat', () => expect(isValidPHCoordinate(NaN, 122)).toBe(false))

  it('rejects non-finite lng', () => expect(isValidPHCoordinate(14, NaN)).toBe(false))

  it('rejects Infinity', () => expect(isValidPHCoordinate(Infinity, 122)).toBe(false))

  it('rejects negative Infinity', () => expect(isValidPHCoordinate(-Infinity, 122)).toBe(false))

  it('rejects lat below PH min', () => expect(isValidPHCoordinate(PH_BOUNDS.minLat - 0.1, 122)).toBe(false))

  it('rejects lat above PH max', () => expect(isValidPHCoordinate(PH_BOUNDS.maxLat + 0.1, 122)).toBe(false))

  it('rejects lng below PH min', () => expect(isValidPHCoordinate(14, PH_BOUNDS.minLng - 0.1)).toBe(false))

  it('rejects lng above PH max', () => expect(isValidPHCoordinate(14, PH_BOUNDS.maxLng + 0.1)).toBe(false))

  it('accepts PH lower-bound', () => expect(isValidPHCoordinate(PH_BOUNDS.minLat, PH_BOUNDS.minLng)).toBe(true))

  it('accepts PH upper-bound', () => expect(isValidPHCoordinate(PH_BOUNDS.maxLat, PH_BOUNDS.maxLng)).toBe(true))

  it('accepts latitude near PH southern bound', () => expect(isValidPHCoordinate(5.0, 118.0)).toBe(true))

  it('rejects longitude outside PH range', () => expect(isValidPHCoordinate(14.0, -125.0)).toBe(false))
})

describe('isWithinCamarinesNorte', () => {
  it('accepts Daet', () => expect(isWithinCamarinesNorte(14.1129, 122.9550)).toBe(true))

  it('accepts lower-bound', () =>
    expect(isWithinCamarinesNorte(CAMARINES_NORTE_BOUNDS.minLat, CAMARINES_NORTE_BOUNDS.minLng)).toBe(true)
  )

  it('accepts upper-bound', () =>
    expect(isWithinCamarinesNorte(CAMARINES_NORTE_BOUNDS.maxLat, CAMARINES_NORTE_BOUNDS.maxLng)).toBe(true)
  )

  it('rejects Manila', () => expect(isWithinCamarinesNorte(14.5995, 120.9842)).toBe(false))

  it('rejects below min', () =>
    expect(isWithinCamarinesNorte(CAMARINES_NORTE_BOUNDS.minLat - 0.1, 122.5)).toBe(false)
  )

  it('rejects above max', () =>
    expect(isWithinCamarinesNorte(CAMARINES_NORTE_BOUNDS.maxLat + 0.1, 122.5)).toBe(false)
  )
})
