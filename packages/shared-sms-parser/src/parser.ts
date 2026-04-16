/** §3 — SMS inbound type synonyms: English / Tagalog */
const TYPE_SYNONYMS: Record<string, string> = {
  FLOOD: 'flood',
  BAHA: 'flood',
  FIRE: 'fire',
  SUNOG: 'fire',
  LANDSLIDE: 'landslide',
  GUHO: 'landslide',
  ACCIDENT: 'accident',
  AKSIDENTE: 'accident',
  MEDICAL: 'medical',
  MEDIKAL: 'medical',
  OTHER: 'other',
  IBA: 'other',
}

export interface SmsParseSuccess {
  success: true
  type: string
  barangay: string
  originalType: string
  originalBarangay: string
}

export interface SmsParseFailure {
  success: false
  reason: 'missing_keyword' | 'unknown_type' | 'missing_barangay'
  raw: string
}

export type SmsParseResult = SmsParseSuccess | SmsParseFailure

export function parseSmsReport(body: string): SmsParseResult {
  const parts = body.trim().toUpperCase().split(/\s+/)

  if (parts[0] !== 'BANTAYOG') {
    return { success: false, reason: 'missing_keyword', raw: body }
  }

  if (parts.length < 3) {
    if (parts.length < 2) {
      return { success: false, reason: 'unknown_type', raw: body }
    }
    return { success: false, reason: 'missing_barangay', raw: body }
  }

  const typeToken = parts[1]
  const resolvedType = TYPE_SYNONYMS[typeToken]
  if (!resolvedType) {
    return { success: false, reason: 'unknown_type', raw: body }
  }

  const barangayTokens = parts.slice(2)
  const barangay = barangayTokens.join('-').toLowerCase()

  return {
    success: true,
    type: resolvedType,
    barangay,
    originalType: typeToken,
    originalBarangay: barangayTokens.join(' '),
  }
}
