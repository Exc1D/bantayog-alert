import type { BarangayId, MunicipalityId } from './branded.js'

export interface GeoPoint {
  readonly lat: number
  readonly lng: number
}

export interface BoundingBox {
  readonly sw: GeoPoint
  readonly ne: GeoPoint
}

export type Geohash = string & { readonly __brand: 'Geohash' }

const GEOHASH_RE = /^[0123456789bcdefghjkmnpqrstuvwxyz]{1,12}$/i

export const asGeohash = (v: string): Geohash => {
  if (!GEOHASH_RE.test(v)) throw new TypeError('Invalid geohash')
  return v.toLowerCase() as Geohash
}

export interface ApproximateLocation {
  readonly municipality: MunicipalityId
  readonly barangay: BarangayId
  readonly geohash: Geohash
}
