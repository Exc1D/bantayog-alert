/**
 * GPS coordinate validation for the Philippines.
 *
 * Used to reject invalid GPS coordinates before they are stored in Firestore.
 * Covers CRITICAL-INPUT-1: (0,0) and out-of-range coordinates were being accepted.
 */

/** Bounding box for the Republic of the Philippines */
export const PH_BOUNDS = {
  minLat: 4.5,
  maxLat: 21.5,
  minLng: 116.0,
  maxLng: 127.0,
} as const

/** Bounding box for Camarines Norte province */
export const CAMARINES_NORTE_BOUNDS = {
  minLat: 13.8,
  maxLat: 14.7,
  minLng: 122.3,
  maxLng: 123.2,
} as const

/**
 * Returns true when the given coordinates fall within Philippine territory
 * and are not the GPS null-island coordinates (0, 0).
 *
 * Guards against:
 * - The default "0, 0" that some devices return when GPS is unavailable
 * - Non-finite values (NaN, Infinity) from faulty sensors
 * - Coordinates clearly outside PH (e.g., Manila, New York)
 */
export function isValidPHCoordinate(lat: number, lng: number): boolean {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false
  if (lat === 0 && lng === 0) return false
  return (
    lat >= PH_BOUNDS.minLat &&
    lat <= PH_BOUNDS.maxLat &&
    lng >= PH_BOUNDS.minLng &&
    lng <= PH_BOUNDS.maxLng
  )
}

/** Returns true when coordinates fall within Camarines Norte province. */
export function isWithinCamarinesNorte(lat: number, lng: number): boolean {
  return (
    lat >= CAMARINES_NORTE_BOUNDS.minLat &&
    lat <= CAMARINES_NORTE_BOUNDS.maxLat &&
    lng >= CAMARINES_NORTE_BOUNDS.minLng &&
    lng <= CAMARINES_NORTE_BOUNDS.maxLng
  )
}
