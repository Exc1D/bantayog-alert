import type { Firestore } from 'firebase-admin/firestore'

interface GeoPoint {
  lat: number
  lng: number
}

interface MunicipalityDoc {
  id: string
  label: string
  centroid?: GeoPoint
}

function squaredDistance(a: GeoPoint, b: GeoPoint): number {
  const dLat = a.lat - b.lat
  const dLng = a.lng - b.lng
  return dLat * dLat + dLng * dLng
}

export interface ReverseGeocodeResult {
  municipalityId: string
  municipalityLabel: string
  barangayId: string
}

export async function reverseGeocodeToMunicipality(
  db: Firestore,
  location: GeoPoint,
): Promise<ReverseGeocodeResult | null> {
  const snap = await db.collection('municipalities').get()
  if (snap.empty) return null

  let nearest: MunicipalityDoc | null = null
  let nearestDist = Infinity

  for (const d of snap.docs) {
    const data = d.data() as MunicipalityDoc
    if (!data.centroid) continue
    const dist = squaredDistance(location, data.centroid)
    if (dist < nearestDist) {
      nearestDist = dist
      nearest = data
    }
  }

  if (!nearest) return null

  return {
    municipalityId: nearest.id,
    municipalityLabel: nearest.label,
    barangayId: 'unknown',
  }
}
