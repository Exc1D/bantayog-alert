/**
 * Fetches Camarines Norte municipality and barangay boundaries from OpenStreetMap
 * via the Overpass API, simplifies geometries, and writes GeoJSON + geohash set
 * to packages/shared-data/src/.
 *
 * Run: pnpm exec tsx scripts/extract-boundaries.ts
 *
 * After running, commit the generated files:
 *   - packages/shared-data/src/municipality-boundaries.geojson
 *   - packages/shared-data/src/barangay-boundaries.geojson
 *   - packages/shared-data/src/boundary-geohash-set.ts
 *
 * OSM data status for Camarines Norte (2026-04-24):
 *   - Municipalities: 4 have boundary polygons (Daet, Paracale, Santa Elena, Vinzons).
 *     8 have only centroid nodes (Capalonga, Basud, Jose Panganiban, Labo,
 *     Mercedes, San Lorenzo Ruiz, San Vicente, Talisay).
 *   - Barangays: ~282 have boundary polygons via relation members.
 *
 * The boundary-geohash-set uses 6-char geohash cells within 2km of any
 * inter-municipal boundary (computed from available polygons + buffered centroids).
 * Barangay boundaries are included for display but not for geohash set generation
 * (too fine-grained for cross-municipality coordination alerts).
 *
 * Risk: OSM boundary quality at 500m precision is unverified for Camarines Norte.
 * Cross-check 3-5 known boundary points against PhilAtlas before committing.
 * If quality is insufficient, replace with MUNICIPALITY_ADJACENCY manual fallback.
 */
import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import * as turf from '@turf/turf'
import ngeohash from 'ngeohash'
import type { FeatureCollection, Feature } from 'geojson'

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter'
const OUTPUT_DIR = resolve(import.meta.dirname, '../packages/shared-data/src')

// Maps OSM relation/node names to internal system IDs
const MUNICIPALITY_NAME_MAP: Record<string, string> = {
  Capalonga: 'capalonga',
  'Jose Panganiban': 'jose-panganiban',
  Labo: 'labo',
  Mercedes: 'mercedes',
  Paracale: 'paracale',
  'San Lorenzo Ruiz': 'san-lorenzo-ruiz',
  'San Vicente': 'san-vicente',
  'Santa Elena': 'santa-elena',
  Talisay: 'talisay',
  Vinzons: 'vinzons',
  Basud: 'basud',
  Daet: 'daet',
}

interface OverpassElement {
  type: string
  id: number
  tags?: Record<string, string>
  geometry?: Array<{ lat: number; lng: number }>
  members?: Array<{ type: string; ref: number; role: string }>
}

interface OverpassResponse {
  elements: OverpassElement[]
}

async function overpassQuery(query: string): Promise<OverpassResponse> {
  const resp = await fetch(OVERPASS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `data=${encodeURIComponent(query)}`,
  })
  if (!resp.ok) throw new Error(`Overpass error ${resp.status}: ${await resp.text()}`)
  return resp.json() as Promise<OverpassResponse>
}

/**
 * Reconstructs a closed polygon ring from OSM relation members.
 * Handles relations whose ways are stored in the same Overpass response.
 */
function buildPolygonFromRelation(
  relation: OverpassElement,
  elements: OverpassElement[],
): Feature<turf.Polygon | turf.MultiPolygon> | null {
  if (!relation.members || relation.members.length === 0) return null

  const wayMap = new Map<number, OverpassElement>()
  for (const el of elements) {
    if (el.type === 'way') wayMap.set(el.id, el)
  }

  const rings: Array<Array<[number, number]>> = []

  for (const member of relation.members) {
    if (member.type !== 'way') continue
    const way = wayMap.get(member.ref)
    if (!way?.geometry || way.geometry.length < 3) continue

    const ring: Array<[number, number]> = way.geometry.map((p) => [p.lng, p.lat])
    if (ring[0]![0] !== ring[ring.length - 1]![0] || ring[0]![1] !== ring[ring.length - 1]![1]) {
      ring.push([ring[0]![0], ring[0]![1]])
    }

    if (member.role === 'outer') {
      rings.unshift(ring)
    } else {
      rings.push(ring)
    }
  }

  if (rings.length === 0) return null
  if (rings.length === 1) return turf.polygon([rings[0]!]) as Feature<turf.Polygon>
  return turf.multiPolygon([rings]) as Feature<turf.MultiPolygon>
}

/**
 * Returns the centroid of a polygon or multi-polygon as a [lng, lat] tuple.
 */
function getCentroidCoord(feature: Feature<turf.Polygon | turf.MultiPolygon>): [number, number] {
  const centroid = turf.centroid(feature)
  return centroid.geometry.coordinates as [number, number]
}

async function main() {
  console.log('Fetching Camarines Norte boundaries from Overpass API...')

  // Phase 1: Query municipality boundary RELATIONS (only 4 of 12 have polygons)
  // Use area ID 3601504550 (Camarines Norte province)
  const CN_AREA_ID = 3601504550
  const muniRelationQuery = `
    [out:json][timeout:120];
    area(${CN_AREA_ID})->.cn;
    relation(area.cn)["admin_level"="6"]["boundary"="administrative"];
    out body;
    >;
    out skel qt;
  `
  const muniRelationData = await overpassQuery(muniRelationQuery)
  const muniRelationMap = new Map<string, OverpassElement>()
  for (const el of muniRelationData.elements) {
    if (el.type === 'relation') {
      const name = el.tags?.['name']
      if (name) muniRelationMap.set(name, el)
    }
  }
  console.log(`Found ${muniRelationMap.size} municipality boundary relations`)

  // Phase 2: Query municipality CENTROID NODES (all 12 municipalities)
  // Some municipalities only have centroid nodes, not boundary polygons
  const muniNodeQuery = `
    [out:json][timeout:120];
    area(${CN_AREA_ID})->.cn;
    node(area.cn)["admin_level"="6"]["boundary"="administrative"];
    out;
  `
  const muniNodeData = await overpassQuery(muniNodeQuery)
  const muniNodeMap = new Map<string, OverpassElement>()
  for (const el of muniNodeData.elements) {
    if (el.type === 'node' && el.geometry) {
      const name = el.tags?.['name']
      if (name) muniNodeMap.set(name, el)
    }
  }
  console.log(`Found ${muniNodeMap.size} municipality centroid nodes`)

  // Phase 3: Build municipality features
  // Use boundary polygon if available, otherwise fall back to buffered centroid
  const muniFeatures: Feature[] = []
  const muniCentroids: Array<{ id: string; name: string; coord: [number, number] }> = []

  for (const [name, id] of Object.entries(MUNICIPALITY_NAME_MAP)) {
    const relation = muniRelationMap.get(name)
    if (relation) {
      // Has boundary polygon — build it
      const feature = buildPolygonFromRelation(relation, muniRelationData.elements)
      if (feature) {
        const simplified = turf.simplify(feature, { tolerance: 0.001, highQuality: true })
        simplified.properties = { municipalityId: id, name }
        muniFeatures.push(simplified)
      } else {
        console.warn(`SKIP: Could not build polygon for "${name}", falling back to centroid`)
        const node = muniNodeMap.get(name)
        if (node?.geometry) {
          muniCentroids.push({ id, name, coord: [node.geometry[0]!.lng, node.geometry[0]!.lat] })
        }
      }
    } else {
      // No boundary polygon — use centroid node
      const node = muniNodeMap.get(name)
      if (node?.geometry) {
        muniCentroids.push({ id, name, coord: [node.geometry[0]!.lng, node.geometry[0]!.lat] })
      } else {
        console.warn(`SKIP: No boundary or centroid for "${name}"`)
      }
    }
  }

  // Create buffered-point features for centroid-only municipalities
  for (const { id, name, coord } of muniCentroids) {
    // Buffer the centroid by ~500m to create a usable polygon approximation
    const point = turf.point(coord)
    const buffered = turf.buffer(point, 0.5, { units: 'kilometers' })
    if (buffered) {
      const simplified = turf.simplify(buffered, { tolerance: 0.001, highQuality: true })
      simplified.properties = { municipalityId: id, name, _centroidOnly: true }
      muniFeatures.push(simplified)
    }
  }

  const muniCollection: FeatureCollection = {
    type: 'FeatureCollection',
    features: muniFeatures,
  }
  writeFileSync(
    resolve(OUTPUT_DIR, 'municipality-boundaries.geojson'),
    JSON.stringify(muniCollection, null, 2),
  )
  console.log(`✓ Wrote ${muniFeatures.length} municipality features`)

  if (muniFeatures.length !== 12) {
    console.error(
      `ERROR: Expected 12 municipalities, got ${muniFeatures.length}. Check MUNICIPALITY_NAME_MAP and Overpass data.`,
    )
    process.exit(1)
  }

  // Phase 4: Query barangay boundaries (admin_level=10 in PH)
  const barangayQuery = `
    [out:json][timeout:180];
    area(${CN_AREA_ID})->.cn;
    relation(area.cn)["admin_level"="10"]["boundary"="administrative"];
    out body;
    >;
    out skel qt;
  `
  const barangayData = await overpassQuery(barangayQuery)

  const barangayRelations = barangayData.elements.filter((el) => el.type === 'relation')
  const barangayFeatures: Feature[] = []

  for (const relation of barangayRelations) {
    const feature = buildPolygonFromRelation(relation, barangayData.elements)
    if (!feature) {
      const name = relation.tags?.['name'] ?? `relation:${relation.id}`
      console.warn(`SKIP: Could not build polygon for barangay "${name}"`)
      continue
    }

    const simplified = turf.simplify(feature, { tolerance: 0.0005, highQuality: true })

    // Determine parent municipality by point-in-polygon on centroid
    const centroidCoord = getCentroidCoord(simplified)
    let parentMunicipalityId: string | undefined
    for (const muniFeature of muniFeatures) {
      if (
        muniFeature.properties?.['_centroidOnly'] ||
        !turf.booleanPointInPolygon(
          centroidCoord,
          muniFeature as Feature<turf.Polygon | turf.MultiPolygon>,
        )
      ) {
        continue
      }
      parentMunicipalityId = muniFeature.properties?.['municipalityId']
      break
    }

    simplified.properties = {
      barangayName: relation.tags?.['name'] ?? '',
      parentMunicipalityId: parentMunicipalityId ?? 'unknown',
    }
    barangayFeatures.push(simplified)
  }

  const barangayCollection: FeatureCollection = {
    type: 'FeatureCollection',
    features: barangayFeatures,
  }
  writeFileSync(
    resolve(OUTPUT_DIR, 'barangay-boundaries.geojson'),
    JSON.stringify(barangayCollection, null, 2),
  )
  console.log(`✓ Wrote ${barangayFeatures.length} barangay features`)

  // Phase 5: Generate boundary geohash set
  // 6-char cells within 2km of any inter-municipal boundary
  const boundaryGeohashes = new Set<string>()

  for (const feature of muniFeatures) {
    const boundary = turf.polygonToLine(feature as turf.Feature<turf.Polygon | turf.MultiPolygon>)
    const buffered = turf.buffer(boundary, 2, { units: 'kilometers' })
    if (!buffered) continue
    const bbox = turf.bbox(buffered)
    const [minLng, minLat, maxLng, maxLat] = bbox
    const cells = ngeohash.bboxes(minLat, minLng, maxLat, maxLng, 6)
    for (const cell of cells) {
      const [lat, lng] = ngeohash.decode(cell) as [number, number]
      if (turf.booleanPointInPolygon([lng, lat], buffered)) {
        boundaryGeohashes.add(cell)
      }
    }
  }

  const geohashArray = [...boundaryGeohashes].sort()
  const tsContent = `// Auto-generated by scripts/extract-boundaries.ts — do not edit manually
export const BOUNDARY_GEOHASH_SET: ReadonlySet<string> = new Set(${JSON.stringify(geohashArray)})
`
  writeFileSync(resolve(OUTPUT_DIR, 'boundary-geohash-set.ts'), tsContent)
  console.log(`✓ Wrote BOUNDARY_GEOHASH_SET with ${boundaryGeohashes.size} geohash cells`)
}

await main()
