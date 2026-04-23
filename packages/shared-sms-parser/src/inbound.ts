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
  details: string | undefined
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
  } catch (err: unknown) {
    // Only suppress MODULE_NOT_FOUND for @bantayog/shared-data; rethrow all other failures
    const isModuleNotFound =
      typeof err === 'object' &&
      err !== null &&
      'code' in err &&
      (err as { code?: string }).code === 'MODULE_NOT_FOUND'
    const message = err instanceof Error ? err.message : ''
    const isSharedDataLoadFailure = message.includes('@bantayog/shared-data')
    if (isModuleNotFound && isSharedDataLoadFailure) {
      return FALLBACK_BARANGAYS
    }
    throw err
  }
  return FALLBACK_BARANGAYS
}

const FALLBACK_BARANGAYS: BarangayEntry[] = [
  // Basud (29 barangays)
  { name: 'Angas', municipality: 'Basud' },
  { name: 'Bactas', municipality: 'Basud' },
  { name: 'Binatagan', municipality: 'Basud' },
  { name: 'Caayunan', municipality: 'Basud' },
  { name: 'Guinatungan', municipality: 'Basud' },
  { name: 'Hinampacan', municipality: 'Basud' },
  { name: 'Langa', municipality: 'Basud' },
  { name: 'Laniton', municipality: 'Basud' },
  { name: 'Lidong', municipality: 'Basud' },
  { name: 'Mampili', municipality: 'Basud' },
  { name: 'Mandazo', municipality: 'Basud' },
  { name: 'Mangcamagong', municipality: 'Basud' },
  { name: 'Manmuntay', municipality: 'Basud' },
  { name: 'Mantugawe', municipality: 'Basud' },
  { name: 'Matnog', municipality: 'Basud' },
  { name: 'Mocong', municipality: 'Basud' },
  { name: 'Oliva', municipality: 'Basud' },
  { name: 'Pagsangahan', municipality: 'Basud' },
  { name: 'Pinagwarasan', municipality: 'Basud' },
  { name: 'Plaridel', municipality: 'Basud' },
  { name: 'Poblacion 1', municipality: 'Basud' },
  { name: 'Poblacion 2', municipality: 'Basud' },
  { name: 'San Felipe', municipality: 'Basud' },
  { name: 'San Jose', municipality: 'Basud' },
  { name: 'San Pascual', municipality: 'Basud' },
  { name: 'Taba-taba', municipality: 'Basud' },
  { name: 'Tacad', municipality: 'Basud' },
  { name: 'Taisan', municipality: 'Basud' },
  { name: 'Tuaca', municipality: 'Basud' },
  // Capalonga (22 barangays)
  { name: 'Alayao', municipality: 'Capalonga' },
  { name: 'Binawangan', municipality: 'Capalonga' },
  { name: 'Calabaca', municipality: 'Capalonga' },
  { name: 'Camagsaan', municipality: 'Capalonga' },
  { name: 'Catabaguangan', municipality: 'Capalonga' },
  { name: 'Catioan', municipality: 'Capalonga' },
  { name: 'Del Pilar', municipality: 'Capalonga' },
  { name: 'Itok', municipality: 'Capalonga' },
  { name: 'Lucbanan', municipality: 'Capalonga' },
  { name: 'Mabini', municipality: 'Capalonga' },
  { name: 'Mactang', municipality: 'Capalonga' },
  { name: 'Magsaysay', municipality: 'Capalonga' },
  { name: 'Mataque', municipality: 'Capalonga' },
  { name: 'Old Camp', municipality: 'Capalonga' },
  { name: 'Poblacion', municipality: 'Capalonga' },
  { name: 'San Antonio', municipality: 'Capalonga' },
  { name: 'San Isidro', municipality: 'Capalonga' },
  { name: 'San Roque', municipality: 'Capalonga' },
  { name: 'Tanawan', municipality: 'Capalonga' },
  { name: 'Ubang', municipality: 'Capalonga' },
  { name: 'Villa Aurora', municipality: 'Capalonga' },
  { name: 'Villa Belen', municipality: 'Capalonga' },
  // Daet (25 barangays)
  { name: 'Alawihao', municipality: 'Daet' },
  { name: 'Awitan', municipality: 'Daet' },
  { name: 'Bagasbas', municipality: 'Daet' },
  { name: 'Barangay I', municipality: 'Daet' },
  { name: 'Barangay II', municipality: 'Daet' },
  { name: 'Barangay III', municipality: 'Daet' },
  { name: 'Barangay IV', municipality: 'Daet' },
  { name: 'Barangay V', municipality: 'Daet' },
  { name: 'Barangay VI', municipality: 'Daet' },
  { name: 'Barangay VII', municipality: 'Daet' },
  { name: 'Barangay VIII', municipality: 'Daet' },
  { name: 'Bibirao', municipality: 'Daet' },
  { name: 'Borabod', municipality: 'Daet' },
  { name: 'Calasgasan', municipality: 'Daet' },
  { name: 'Camambugan', municipality: 'Daet' },
  { name: 'Cobangbang', municipality: 'Daet' },
  { name: 'Dogongan', municipality: 'Daet' },
  { name: 'Gahonon', municipality: 'Daet' },
  { name: 'Gubat', municipality: 'Daet' },
  { name: 'Lag-on', municipality: 'Daet' },
  { name: 'Magang', municipality: 'Daet' },
  { name: 'Mambalite', municipality: 'Daet' },
  { name: 'Mancruz', municipality: 'Daet' },
  { name: 'Pamorangon', municipality: 'Daet' },
  { name: 'San Isidro', municipality: 'Daet' },
  // Jose Panganiban (27 barangays)
  { name: 'Bagong Bayan', municipality: 'Jose Panganiban' },
  { name: 'Calero', municipality: 'Jose Panganiban' },
  { name: 'Dahican', municipality: 'Jose Panganiban' },
  { name: 'Dayhagan', municipality: 'Jose Panganiban' },
  { name: 'Larap', municipality: 'Jose Panganiban' },
  { name: 'Luklukan Norte', municipality: 'Jose Panganiban' },
  { name: 'Luklukan Sur', municipality: 'Jose Panganiban' },
  { name: 'Motherlode', municipality: 'Jose Panganiban' },
  { name: 'Nakalaya', municipality: 'Jose Panganiban' },
  { name: 'North Poblacion', municipality: 'Jose Panganiban' },
  { name: 'Osmeña', municipality: 'Jose Panganiban' },
  { name: 'Pag-asa', municipality: 'Jose Panganiban' },
  { name: 'Parang', municipality: 'Jose Panganiban' },
  { name: 'Plaridel', municipality: 'Jose Panganiban' },
  { name: 'Salvacion', municipality: 'Jose Panganiban' },
  { name: 'San Isidro', municipality: 'Jose Panganiban' },
  { name: 'San Jose', municipality: 'Jose Panganiban' },
  { name: 'San Martin', municipality: 'Jose Panganiban' },
  { name: 'San Pedro', municipality: 'Jose Panganiban' },
  { name: 'San Rafael', municipality: 'Jose Panganiban' },
  { name: 'Santa Cruz', municipality: 'Jose Panganiban' },
  { name: 'Santa Elena', municipality: 'Jose Panganiban' },
  { name: 'Santa Milagrosa', municipality: 'Jose Panganiban' },
  { name: 'Santa Rosa Norte', municipality: 'Jose Panganiban' },
  { name: 'Santa Rosa Sur', municipality: 'Jose Panganiban' },
  { name: 'South Poblacion', municipality: 'Jose Panganiban' },
  { name: 'Tamisan', municipality: 'Jose Panganiban' },
  // Labo (52 barangays)
  { name: 'Anahaw', municipality: 'Labo' },
  { name: 'Anameam', municipality: 'Labo' },
  { name: 'Awitan', municipality: 'Labo' },
  { name: 'Baay', municipality: 'Labo' },
  { name: 'Bagacay', municipality: 'Labo' },
  { name: 'Bagong Silang I', municipality: 'Labo' },
  { name: 'Bagong Silang II', municipality: 'Labo' },
  { name: 'Bagong Silang III', municipality: 'Labo' },
  { name: 'Bakiad', municipality: 'Labo' },
  { name: 'Bautista', municipality: 'Labo' },
  { name: 'Bayabas', municipality: 'Labo' },
  { name: 'Bayan-bayan', municipality: 'Labo' },
  { name: 'Benit', municipality: 'Labo' },
  { name: 'Bulhao', municipality: 'Labo' },
  { name: 'Cabatuhan', municipality: 'Labo' },
  { name: 'Cabusay', municipality: 'Labo' },
  { name: 'Calabasa', municipality: 'Labo' },
  { name: 'Canapawan', municipality: 'Labo' },
  { name: 'Daguit', municipality: 'Labo' },
  { name: 'Dalas', municipality: 'Labo' },
  { name: 'Dumagmang', municipality: 'Labo' },
  { name: 'Exciban', municipality: 'Labo' },
  { name: 'Fundado', municipality: 'Labo' },
  { name: 'Guinacutan', municipality: 'Labo' },
  { name: 'Guisican', municipality: 'Labo' },
  { name: 'Gumamela', municipality: 'Labo' },
  { name: 'Iberica', municipality: 'Labo' },
  { name: 'Kalamunding', municipality: 'Labo' },
  { name: 'Lugui', municipality: 'Labo' },
  { name: 'Mabilo I', municipality: 'Labo' },
  { name: 'Mabilo II', municipality: 'Labo' },
  { name: 'Macogon', municipality: 'Labo' },
  { name: 'Mahawan-hawan', municipality: 'Labo' },
  { name: 'Malangcao-Basud', municipality: 'Labo' },
  { name: 'Malasugui', municipality: 'Labo' },
  { name: 'Malatap', municipality: 'Labo' },
  { name: 'Malaya', municipality: 'Labo' },
  { name: 'Malibago', municipality: 'Labo' },
  { name: 'Maot', municipality: 'Labo' },
  { name: 'Masalong', municipality: 'Labo' },
  { name: 'Matanlang', municipality: 'Labo' },
  { name: 'Napaod', municipality: 'Labo' },
  { name: 'Pag-asa', municipality: 'Labo' },
  { name: 'Pangpang', municipality: 'Labo' },
  { name: 'Pinya', municipality: 'Labo' },
  { name: 'San Antonio', municipality: 'Labo' },
  { name: 'San Francisco', municipality: 'Labo' },
  { name: 'Santa Cruz', municipality: 'Labo' },
  { name: 'Submakin', municipality: 'Labo' },
  { name: 'Talobatib', municipality: 'Labo' },
  { name: 'Tigbinan', municipality: 'Labo' },
  { name: 'Tulay na Lupa', municipality: 'Labo' },
  // Mercedes (27 barangays)
  { name: 'Apuao', municipality: 'Mercedes' },
  { name: 'Barangay I', municipality: 'Mercedes' },
  { name: 'Barangay II', municipality: 'Mercedes' },
  { name: 'Barangay III', municipality: 'Mercedes' },
  { name: 'Barangay IV', municipality: 'Mercedes' },
  { name: 'Barangay V', municipality: 'Mercedes' },
  { name: 'Barangay VI', municipality: 'Mercedes' },
  { name: 'Barangay VII', municipality: 'Mercedes' },
  { name: 'Caringo', municipality: 'Mercedes' },
  { name: 'Catandunganon', municipality: 'Mercedes' },
  { name: 'Cayucyucan', municipality: 'Mercedes' },
  { name: 'Colasi', municipality: 'Mercedes' },
  { name: 'Del Rosario', municipality: 'Mercedes' },
  { name: 'Gaboc', municipality: 'Mercedes' },
  { name: 'Hamoraon', municipality: 'Mercedes' },
  { name: 'Hinipaan', municipality: 'Mercedes' },
  { name: 'Lalawigan', municipality: 'Mercedes' },
  { name: 'Lanot', municipality: 'Mercedes' },
  { name: 'Mambungalon', municipality: 'Mercedes' },
  { name: 'Manguisoc', municipality: 'Mercedes' },
  { name: 'Masalongsalong', municipality: 'Mercedes' },
  { name: 'Matoogtoog', municipality: 'Mercedes' },
  { name: 'Pambuhan', municipality: 'Mercedes' },
  { name: 'Quinapaguian', municipality: 'Mercedes' },
  { name: 'San Roque', municipality: 'Mercedes' },
  { name: 'Tarum', municipality: 'Mercedes' },
  // Paracale (31 barangays)
  { name: 'Awitan', municipality: 'Paracale' },
  { name: 'Bagumbayan', municipality: 'Paracale' },
  { name: 'Bakal', municipality: 'Paracale' },
  { name: 'Batobalani', municipality: 'Paracale' },
  { name: 'Calaburnay', municipality: 'Paracale' },
  { name: 'Capacuan', municipality: 'Paracale' },
  { name: 'Casalugan', municipality: 'Paracale' },
  { name: 'Dagang', municipality: 'Paracale' },
  { name: 'Dalnac', municipality: 'Paracale' },
  { name: 'Dancalan', municipality: 'Paracale' },
  { name: 'Gumaus', municipality: 'Paracale' },
  { name: 'Labnig', municipality: 'Paracale' },
  { name: 'Macolabo Island', municipality: 'Paracale' },
  { name: 'Malacbang', municipality: 'Paracale' },
  { name: 'Malaguit', municipality: 'Paracale' },
  { name: 'Mampungo', municipality: 'Paracale' },
  { name: 'Mangkasay', municipality: 'Paracale' },
  { name: 'Maybato', municipality: 'Paracale' },
  { name: 'Palanas', municipality: 'Paracale' },
  { name: 'Pinagbirayan Malaki', municipality: 'Paracale' },
  { name: 'Pinagbirayan Munti', municipality: 'Paracale' },
  { name: 'Poblacion Norte', municipality: 'Paracale' },
  { name: 'Poblacion Sur', municipality: 'Paracale' },
  { name: 'Tabas', municipality: 'Paracale' },
  { name: 'Talusan', municipality: 'Paracale' },
  { name: 'Tawig', municipality: 'Paracale' },
  { name: 'Tugos', municipality: 'Paracale' },
  // San Lorenzo Ruiz (12 barangays)
  { name: 'Daculang Bolo', municipality: 'San Lorenzo Ruiz' },
  { name: 'Dagotdotan', municipality: 'San Lorenzo Ruiz' },
  { name: 'Langga', municipality: 'San Lorenzo Ruiz' },
  { name: 'Laniton', municipality: 'San Lorenzo Ruiz' },
  { name: 'Maisog', municipality: 'San Lorenzo Ruiz' },
  { name: 'Mampurog', municipality: 'San Lorenzo Ruiz' },
  { name: 'Manlimonsito', municipality: 'San Lorenzo Ruiz' },
  { name: 'Matacong', municipality: 'San Lorenzo Ruiz' },
  { name: 'Salvacion', municipality: 'San Lorenzo Ruiz' },
  { name: 'San Antonio', municipality: 'San Lorenzo Ruiz' },
  { name: 'San Isidro', municipality: 'San Lorenzo Ruiz' },
  { name: 'San Ramon', municipality: 'San Lorenzo Ruiz' },
  // San Vicente (9 barangays)
  { name: 'Asdum', municipality: 'San Vicente' },
  { name: 'Cabanbanan', municipality: 'San Vicente' },
  { name: 'Calabagas', municipality: 'San Vicente' },
  { name: 'Fabrica', municipality: 'San Vicente' },
  { name: 'Iraya Sur', municipality: 'San Vicente' },
  { name: 'Man-ogob', municipality: 'San Vicente' },
  { name: 'Poblacion District I', municipality: 'San Vicente' },
  { name: 'Poblacion District II', municipality: 'San Vicente' },
  { name: 'San Jose', municipality: 'San Vicente' },
  // Santa Elena (20 barangays)
  { name: 'Basiad', municipality: 'Santa Elena' },
  { name: 'Bulala', municipality: 'Santa Elena' },
  { name: 'Don Tomas', municipality: 'Santa Elena' },
  { name: 'Guitol', municipality: 'Santa Elena' },
  { name: 'Kabuluan', municipality: 'Santa Elena' },
  { name: 'Kagtalaba', municipality: 'Santa Elena' },
  { name: 'Maulawin', municipality: 'Santa Elena' },
  { name: 'Patag Ibaba', municipality: 'Santa Elena' },
  { name: 'Patag Iraya', municipality: 'Santa Elena' },
  { name: 'Plaridel', municipality: 'Santa Elena' },
  { name: 'Polungguitguit', municipality: 'Santa Elena' },
  { name: 'Rizal', municipality: 'Santa Elena' },
  { name: 'Salvacion', municipality: 'Santa Elena' },
  { name: 'San Lorenzo', municipality: 'Santa Elena' },
  { name: 'San Pedro', municipality: 'Santa Elena' },
  { name: 'San Vicente', municipality: 'Santa Elena' },
  { name: 'Santa Elena', municipality: 'Santa Elena' },
  { name: 'Tabugon', municipality: 'Santa Elena' },
  { name: 'Villa San Isidro', municipality: 'Santa Elena' },
  // Talisay (15 barangays)
  { name: 'Binanuaan', municipality: 'Talisay' },
  { name: 'Caawigan', municipality: 'Talisay' },
  { name: 'Cahabaan', municipality: 'Talisay' },
  { name: 'Calintaan', municipality: 'Talisay' },
  { name: 'Del Carmen', municipality: 'Talisay' },
  { name: 'Gabon', municipality: 'Talisay' },
  { name: 'Itomang', municipality: 'Talisay' },
  { name: 'Poblacion', municipality: 'Talisay' },
  { name: 'San Francisco', municipality: 'Talisay' },
  { name: 'San Isidro', municipality: 'Talisay' },
  { name: 'San Jose', municipality: 'Talisay' },
  { name: 'San Nicolas', municipality: 'Talisay' },
  { name: 'Santa Cruz', municipality: 'Talisay' },
  { name: 'Santa Elena', municipality: 'Talisay' },
  { name: 'Santo Niño', municipality: 'Talisay' },
  // Vinzons (19 barangays)
  { name: 'Aguit-it', municipality: 'Vinzons' },
  { name: 'Banocboc', municipality: 'Vinzons' },
  { name: 'Barangay I', municipality: 'Vinzons' },
  { name: 'Barangay II', municipality: 'Vinzons' },
  { name: 'Barangay III', municipality: 'Vinzons' },
  { name: 'Cagbalogo', municipality: 'Vinzons' },
  { name: 'Calangcawan Norte', municipality: 'Vinzons' },
  { name: 'Calangcawan Sur', municipality: 'Vinzons' },
  { name: 'Guinacutan', municipality: 'Vinzons' },
  { name: 'Mangcawayan', municipality: 'Vinzons' },
  { name: 'Mangcayo', municipality: 'Vinzons' },
  { name: 'Manlucugan', municipality: 'Vinzons' },
  { name: 'Matango', municipality: 'Vinzons' },
  { name: 'Napilihan', municipality: 'Vinzons' },
  { name: 'Pinagtigasan', municipality: 'Vinzons' },
  { name: 'Sabang', municipality: 'Vinzons' },
  { name: 'Santo Domingo', municipality: 'Vinzons' },
  { name: 'Singi', municipality: 'Vinzons' },
  { name: 'Sula', municipality: 'Vinzons' },
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
      // @ts-expect-error: DP array access is bounds-checked by loop
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? // @ts-expect-error: diagonal DP access
            dp[i - 1][j - 1]
          : 1 +
            Math.min(
              // @ts-expect-error: DP array accesses
              dp[i - 1][j],
              // @ts-expect-error: DP array accesses
              dp[i][j - 1],
              // @ts-expect-error: DP array accesses
              dp[i - 1][j - 1],
            )
    }
  }
  // @ts-expect-error: return from DP is always valid after loop
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
    barangayToken = token1 + ' ' + token2
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
    const match = fuzzyMatches[0] as { entry: BarangayEntry; distance: number }
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
