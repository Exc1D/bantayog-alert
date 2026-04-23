import { createRequire } from 'node:module'
import { z } from 'zod'

const require = createRequire(import.meta.url)

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

const TYPE_SYNONYMS = {
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

function getBarangayGazetteer() {
  try {
    const mod = require('@bantayog/shared-data')
    if (mod.BARANGAY_GAZETTEER && Array.isArray(mod.BARANGAY_GAZETTEER)) {
      return mod.BARANGAY_GAZETTEER
    }
  } catch {
    // shared-data not yet populated - use fallback
  }
  return FALLBACK_BARANGAYS
}

function levenshtein(a, b) {
  const m = a.length
  const n = b.length
  if (m === 0) return n
  if (n === 0) return m
  const dp = Array.from({ length: m + 1 }, (_, i) =>
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

function buildAutoReply(confidence, publicRef = '') {
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

export function parseInboundSms(body) {
  const normalized = body.trim().replace(/\s+/g, ' ').toUpperCase()
  const originalRest = body.trim().replace(/\s+/g, ' ')

  if (!normalized.startsWith('BANTAYOG')) {
    return {
      confidence: 'none',
      parsed: null,
      candidates: [],
      autoReplyText: buildAutoReply('none'),
    }
  }

  const rest = normalized.slice('BANTAYOG'.length).trim()
  if (!rest) {
    return {
      confidence: 'none',
      parsed: null,
      candidates: [],
      autoReplyText: buildAutoReply('none'),
    }
  }

  const tokens = rest.split(/\s+/)
  const token0 = tokens[0]
  const token1 = tokens[1]
  if (tokens.length < 2 || !token0 || !token1) {
    return {
      confidence: 'none',
      parsed: null,
      candidates: [],
      autoReplyText: buildAutoReply('none'),
    }
  }

  const typeToken = token0
  let barangayToken = token1
  let detailsStartIndex = barangayToken.length

  const token2 = tokens[2]
  if (tokens.length >= 3 && token2 && MUNICIPALITY_PREFIXES.has(token1)) {
    barangayToken = `${token1} ${token2}`
    detailsStartIndex = barangayToken.length
  }

  const barangayIndex = originalRest.toUpperCase().indexOf(barangayToken.toUpperCase())
  const details =
    barangayIndex !== -1 && barangayIndex + detailsStartIndex < originalRest.length
      ? originalRest.slice(barangayIndex + detailsStartIndex).trim()
      : undefined

  const reportType = TYPE_SYNONYMS[typeToken.toUpperCase()]
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
      parsed: { reportType, barangay: exact.name, details },
      candidates: [],
      autoReplyText: buildAutoReply('high'),
    }
  }

  const fuzzyMatches = []
  for (const entry of gazetteer) {
    const distance = levenshtein(barangayLower, entry.name.toLowerCase())
    if (distance <= 2) {
      fuzzyMatches.push({ entry, distance })
    }
  }

  if (fuzzyMatches.length === 1) {
    const match = fuzzyMatches[0]
    return {
      confidence: match.distance <= 1 ? 'medium' : 'low',
      parsed: {
        reportType,
        barangay: match.entry.name,
        rawBarangay: barangayToken,
        details,
      },
      candidates: [],
      autoReplyText: buildAutoReply(match.distance <= 1 ? 'medium' : 'low'),
    }
  }

  if (fuzzyMatches.length > 1) {
    fuzzyMatches.sort((a, b) => a.distance - b.distance)
    return {
      confidence: 'low',
      parsed: null,
      candidates: fuzzyMatches.slice(0, 3).map((match) => match.entry.name),
      autoReplyText: buildAutoReply('low'),
    }
  }

  return { confidence: 'none', parsed: null, candidates: [], autoReplyText: buildAutoReply('none') }
}
