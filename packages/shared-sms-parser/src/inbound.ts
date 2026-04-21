// ─── Types ────────────────────────────────────────────────────────────────────

import { z } from 'zod'

export type Confidence = 'high' | 'medium' | 'low' | 'none'

export const reportTypeSchema = z.enum([
  'flood',
  'fire',
  'landslide',
  'accident',
  'medical',
  'other',
])
export type ReportType = z.infer<typeof reportTypeSchema>

export interface ParsedFields {
  reportType: ReportType
  barangay: string
  rawBarangay?: string
  details?: string
}

export interface ParseResult {
  confidence: Confidence
  parsed: ParsedFields | null
  candidates: string[]
  autoReplyText: string
}

// ─── Barangay Gazetteer ───────────────────────────────────────────────────────

interface BarangayEntry {
  name: string
  municipality: string
}

function getBarangayGazetteer(): BarangayEntry[] {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('@bantayog/shared-data') as { BARANGAY_GAZETTEER?: unknown }
    if (mod.BARANGAY_GAZETTEER && Array.isArray(mod.BARANGAY_GAZETTEER)) {
      return mod.BARANGAY_GAZETTEER as BarangayEntry[]
    }
  } catch {
    // shared-data not yet populated — use fallback
  }
  return FALLBACK_BARANGAYS
}

const FALLBACK_BARANGAYS: BarangayEntry[] = [
  { name: 'Alcoc', municipality: 'Alcoc' },
  { name: 'Alcoy', municipality: 'Alcoy' },
  { name: 'Bagasbas', municipality: 'Daet' },
  { name: 'Baay', municipality: 'Labo' },
  { name: 'Babang', municipality: 'Daet' },
  { name: 'Calasgasan', municipality: 'Daet' },
  { name: 'Daet', municipality: 'Daet' },
  { name: 'Gubat', municipality: 'Daet' },
  { name: 'Labo', municipality: 'Labo' },
  { name: 'Maguiron', municipality: 'Labo' },
  { name: 'Mancot', municipality: 'Daet' },
  { name: 'Mangcamamund', municipality: 'Daet' },
  { name: 'Namo', municipality: 'Jose Panganiban' },
  { name: 'Namnama', municipality: 'Daet' },
  { name: 'Namoc', municipality: 'Daet' },
  { name: 'Pandan', municipality: 'Daet' },
  { name: 'Parang', municipality: 'Jose Panganiban' },
  { name: 'San', municipality: 'Jose Panganiban' },
  { name: 'San Jose', municipality: 'Jose Panganiban' },
]

// ─── Levenshtein distance ─────────────────────────────────────────────────────

function levenshtein(a: string, b: string): number {
  const m = a.length
  const n = b.length
  if (m === 0) return n
  if (n === 0) return m
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  )
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
    }
  }
  return dp[m][n]
}

// ─── Type synonym map ─────────────────────────────────────────────────────────

const TYPE_SYNONYMS: Record<string, ReportType> = {
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

const MUNICIPALITY_PREFIXES = new Set(['SAN', 'STA', 'SANTA'])

// ─── Auto-reply templates ─────────────────────────────────────────────────────

function buildAutoReply(confidence: Confidence, publicRef?: string): string {
  // publicRef intentionally unused — ref is appended by the trigger caller after this returns
  const ref = publicRef ? ` Ref: ${publicRef}.` : ''
  switch (confidence) {
    case 'high':
      return `Received.${ref} MDRRMO reviewing.`
    case 'medium':
      return `Received,${ref} Our team may contact you for details.`
    case 'low':
      return `Received.${ref} Our team reviewing your report.`
    case 'none':
    default:
      return 'We received your message. To report an emergency, text: BANTAYOG <TYPE> <BARANGAY>. Types: FLOOD, FIRE, ACCIDENT, MEDICAL, LANDSLIDE, OTHER.'
  }
}

// ─── Main parser ──────────────────────────────────────────────────────────────

export function parseInboundSms(body: string): ParseResult {
  const normalized = body.trim().replace(/\s+/g, ' ').toUpperCase()
  const originalRest = body.trim().replace(/\s+/g, ' ')

  const KEYWORD = 'BANTAYOG'
  if (!normalized.startsWith(KEYWORD)) {
    return {
      confidence: 'none',
      parsed: null,
      candidates: [],
      autoReplyText: buildAutoReply('none'),
    }
  }

  const rest = normalized.slice(KEYWORD.length).trim()
  if (!rest) {
    return {
      confidence: 'none',
      parsed: null,
      candidates: [],
      autoReplyText: buildAutoReply('none'),
    }
  }

  const tokens = rest.split(/\s+/)
  if (tokens.length < 2) {
    return {
      confidence: 'none',
      parsed: null,
      candidates: [],
      autoReplyText: buildAutoReply('none'),
    }
  }

  const typeToken = tokens[0] ?? ''
  let barangayToken = tokens[1] ?? ''
  let detailsStartIndex = barangayToken.length

  if (tokens.length >= 3 && tokens[1] && tokens[2] && MUNICIPALITY_PREFIXES.has(tokens[1])) {
    barangayToken = tokens[1] + ' ' + tokens[2]
    detailsStartIndex = barangayToken.length
  }

  const barangayIndex = originalRest.toUpperCase().indexOf(barangayToken.toUpperCase())
  const details =
    barangayIndex !== -1 && barangayIndex + detailsStartIndex < originalRest.length
      ? originalRest.slice(barangayIndex + detailsStartIndex).trim()
      : undefined

  const rawType = typeToken.toUpperCase()
  const reportType = TYPE_SYNONYMS[rawType]
  if (!reportType) {
    return {
      confidence: 'none',
      parsed: null,
      candidates: [],
      autoReplyText: buildAutoReply('none'),
    }
  }

  const gazetteer = getBarangayGazetteer()
  const barangayLower = barangayToken.toLowerCase()

  const exact = gazetteer.find((b) => b.name.toLowerCase() === barangayLower)
  if (exact) {
    return {
      confidence: 'high',
      parsed: {
        reportType,
        barangay: exact.name,
        details,
      },
      candidates: [],
      autoReplyText: buildAutoReply('high'),
    }
  }

  const fuzzyMatches: { entry: BarangayEntry; distance: number }[] = []
  for (const entry of gazetteer) {
    const dist = levenshtein(barangayLower, entry.name.toLowerCase())
    if (dist <= 2) {
      fuzzyMatches.push({ entry, distance: dist })
    }
  }

  if (fuzzyMatches.length === 1) {
    const match = fuzzyMatches[0]
    const dist = match.distance
    const entry: BarangayEntry = match.entry
    return {
      confidence: dist <= 1 ? 'medium' : 'low',
      parsed: {
        reportType,
        barangay: entry.name,
        rawBarangay: barangayToken,
        details,
      },
      candidates: [],
      autoReplyText: buildAutoReply(dist <= 1 ? 'medium' : 'low'),
    }
  }

  if (fuzzyMatches.length > 1) {
    fuzzyMatches.sort((a, b) => a.distance - b.distance)
    const candidates = fuzzyMatches.slice(0, 3).map((m) => m.entry.name)
    return {
      confidence: 'low',
      parsed: null,
      candidates,
      autoReplyText: buildAutoReply('low'),
    }
  }

  return {
    confidence: 'none',
    parsed: null,
    candidates: [],
    autoReplyText: buildAutoReply('none'),
  }
}
