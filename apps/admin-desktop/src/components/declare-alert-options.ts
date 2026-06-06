import { getBarangayGazetteer } from '@bantayog/shared-sms-parser'
import { CAMARINES_NORTE_MUNICIPALITIES } from '@bantayog/shared-validators'

export const MUNICIPALITIES = CAMARINES_NORTE_MUNICIPALITIES

export const MUNICIPALITY_ID_TO_LABEL = Object.fromEntries(
  MUNICIPALITIES.map((m) => [m.id, m.label]),
)

const MUNICIPALITY_LABEL_TO_ID = Object.fromEntries(MUNICIPALITIES.map((m) => [m.label, m.id]))

export const ALLOWED_MUNICIPALITY_IDS = new Set(MUNICIPALITIES.map((m) => m.id))

let barangaysByMunicipalityCache: Record<string, string[]> | null = null

export function getBarangaysByMunicipality(): Record<string, string[]> {
  if (barangaysByMunicipalityCache) return barangaysByMunicipalityCache

  const result: Record<string, string[]> = {}
  const gazetteer = getBarangayGazetteer()
  for (const b of gazetteer) {
    const municipalityId = MUNICIPALITY_LABEL_TO_ID[b.municipality]
    if (municipalityId) {
      result[municipalityId] ??= []
      result[municipalityId].push(b.name)
    }
  }
  barangaysByMunicipalityCache = result
  return result
}

export const BARANGAYS_BY_MUNICIPALITY = getBarangaysByMunicipality()

export const HAZARD_TYPE_LABELS: Record<string, string> = {
  tropical_cyclone: 'Tropical Cyclone (Typhoon)',
  heavy_rainfall_warning: 'Heavy Rainfall Warning',
  thunderstorm_advisory: 'Thunderstorm Advisory',
  flood_advisory: 'Flood Advisory / Warning',
  storm_surge_warning: 'Storm Surge Warning',
  gale_warning: 'Gale Warning',
  heat_index_warning: 'Heat Index Warning',
  cold_surge_advisory: 'Cold Surge Advisory',
  earthquake: 'Earthquake',
  volcanic_eruption: 'Volcanic Eruption / Activity',
  landslide: 'Landslide',
  tsunami_warning: 'Tsunami Warning',
  drought: 'Drought / Dry Spell',
  fire: 'Fire (Structural / Forest / Grass)',
  scheduled_power_interruption: 'Scheduled Power Interruption',
  emergency_power_interruption: 'Emergency Power Interruption',
  water_service_interruption: 'Water Service Interruption',
  road_closure: 'Road Closure',
  bridge_closure: 'Bridge Closure',
  telecommunication_outage: 'Telecommunication Outage',
  structural_damage: 'Structural / Building Damage',
  class_suspension: 'Class Suspension',
  work_suspension: 'Work Suspension',
  transport_suspension: 'Transport Suspension',
  curfew: 'Curfew',
  state_of_calamity: 'State of Calamity',
  preemptive_evacuation: 'Pre-emptive Evacuation',
  evacuation_order: 'Evacuation Order',
  security_incident: 'Security Incident',
  crime_alert: 'Crime Alert',
  health_advisory: 'Health Advisory',
  disease_outbreak: 'Disease Outbreak / Epidemic Alert',
  other: 'Other (specify in message)',
}

export const HAZARD_GROUPS = [
  {
    label: 'Weather & Flood',
    types: [
      'tropical_cyclone',
      'heavy_rainfall_warning',
      'thunderstorm_advisory',
      'flood_advisory',
      'storm_surge_warning',
      'gale_warning',
      'heat_index_warning',
      'cold_surge_advisory',
    ],
  },
  {
    label: 'Geophysical & Natural',
    types: ['earthquake', 'volcanic_eruption', 'landslide', 'tsunami_warning', 'drought', 'fire'],
  },
  {
    label: 'Utilities & Infrastructure',
    types: [
      'scheduled_power_interruption',
      'emergency_power_interruption',
      'water_service_interruption',
      'road_closure',
      'bridge_closure',
      'telecommunication_outage',
      'structural_damage',
    ],
  },
  {
    label: 'Public Service Orders',
    types: [
      'class_suspension',
      'work_suspension',
      'transport_suspension',
      'curfew',
      'state_of_calamity',
      'preemptive_evacuation',
      'evacuation_order',
    ],
  },
  {
    label: 'Security & Health',
    types: ['security_incident', 'crime_alert', 'health_advisory', 'disease_outbreak'],
  },
  { label: 'Other', types: ['other'] },
]

export const SECTOR_LABELS: Record<string, string> = {
  public_schools: 'Public Schools',
  private_schools: 'Private Schools',
  government_offices: 'Government Offices',
  private_business: 'Private Business',
  healthcare: 'Healthcare',
  transportation: 'Transportation',
  all: 'All Sectors',
}

export const SECTOR_TYPES = Object.keys(SECTOR_LABELS)

export function formatShortList(items: string[]): string {
  if (items.length <= 3) return items.join(', ')
  return `${items.slice(0, 3).join(', ')} +${String(items.length - 3)} more`
}
