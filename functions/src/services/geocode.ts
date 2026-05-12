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

export interface ReverseGeocodeResult {
  municipalityId: string
  municipalityLabel: string
  barangayId: string
}

let cachedMunis: MunicipalityDoc[] | null = null

async function loadMunicipalities(db: Firestore): Promise<MunicipalityDoc[]> {
  if (cachedMunis) return cachedMunis
  const snap = await db.collection('municipalities').get()
  cachedMunis = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<MunicipalityDoc, 'id'>) }))
  return cachedMunis
}

function squaredDistance(a: GeoPoint, b: GeoPoint): number {
  const dLat = a.lat - b.lat
  const dLng = a.lng - b.lng
  return dLat * dLat + dLng * dLng
}

export async function reverseGeocodeToMunicipality(
  db: Firestore,
  location: GeoPoint,
): Promise<ReverseGeocodeResult | null> {
  const munis = await loadMunicipalities(db)
  if (munis.length === 0) return null

  let nearest: MunicipalityDoc | null = null
  let nearestDist = Infinity

  for (const m of munis) {
    if (!m.centroid) continue
    const dist = squaredDistance(location, m.centroid)
    if (dist < nearestDist) {
      nearestDist = dist
      nearest = m
    }
  }

  if (!nearest?.centroid) return null

  const MAX_SQUARED_DIST = 1.0
  if (nearestDist > MAX_SQUARED_DIST) return null

  return {
    municipalityId: nearest.id,
    municipalityLabel: nearest.label,
    barangayId: 'unknown',
  }
}
