// ─── Types ────────────────────────────────────────────────────────────────────
import { z } from 'zod';
import { buildAutoReply } from './auto-reply.js';
import { getBarangayGazetteer } from './gazetteer.js';
import { levenshtein } from './levenshtein.js';
export const reportTypeSchema = z.enum([
    'flood',
    'fire',
    'landslide',
    'accident',
    'medical',
    'other',
]);
// ─── Type synonym map ─────────────────────────────────────────────────────────
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
};
const MUNICIPALITY_PREFIXES = new Set(['SAN', 'STA', 'SANTA']);
// ─── Main parser ──────────────────────────────────────────────────────────────
export function parseInboundSms(body) {
    if (typeof body !== 'string') {
        return {
            confidence: 'none',
            parsed: null,
            candidates: [],
            autoReplyText: buildAutoReply('none'),
        };
    }
    const normalized = body.trim().replace(/\s+/g, ' ').toUpperCase();
    const originalRest = body.trim().replace(/\s+/g, ' ');
    const KEYWORD = 'BANTAYOG';
    if (!normalized.startsWith(KEYWORD)) {
        return {
            confidence: 'none',
            parsed: null,
            candidates: [],
            autoReplyText: buildAutoReply('none'),
        };
    }
    const rest = normalized.slice(KEYWORD.length).trim();
    if (!rest) {
        return {
            confidence: 'none',
            parsed: null,
            candidates: [],
            autoReplyText: buildAutoReply('none'),
        };
    }
    const tokens = rest.split(/\s+/);
    const token0 = tokens[0];
    const token1 = tokens[1];
    if (tokens.length < 2 || !token0 || !token1) {
        return {
            confidence: 'none',
            parsed: null,
            candidates: [],
            autoReplyText: buildAutoReply('none'),
        };
    }
    const gazetteer = getBarangayGazetteer();
    const gazetteerNamesUpper = new Set(gazetteer.map((b) => b.name.toUpperCase()));
    const typeToken = token0;
    let barangayToken = token1;
    let detailsStartIndex = barangayToken.length;
    const token2 = tokens[2];
    const token3 = tokens[3];
    if (tokens.length >= 3 && token2 && MUNICIPALITY_PREFIXES.has(token1)) {
        const twoWord = `${token1} ${token2}`;
        const threeWord = token3 ? `${twoWord} ${token3}` : undefined;
        barangayToken = threeWord && gazetteerNamesUpper.has(threeWord) ? threeWord : twoWord;
        detailsStartIndex = barangayToken.length;
    }
    // Find the barangay token in originalRest using lastIndexOf to prefer the occurrence
    // closest to where details would start (avoids matching an earlier instance of the token).
    const barangayTokenUpper = barangayToken.toUpperCase();
    const barangayIndex = originalRest.toUpperCase().lastIndexOf(barangayTokenUpper);
    const details = barangayIndex !== -1 && barangayIndex + detailsStartIndex < originalRest.length
        ? originalRest.slice(barangayIndex + detailsStartIndex).trim()
        : undefined;
    const rawType = typeToken.toUpperCase();
    const reportType = TYPE_SYNONYMS[rawType];
    if (!reportType) {
        return {
            confidence: 'none',
            parsed: null,
            candidates: [],
            autoReplyText: buildAutoReply('none'),
        };
    }
    const barangayLower = barangayToken.toLowerCase();
    const exact = gazetteer.find((b) => b.name.toLowerCase() === barangayLower);
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
        };
    }
    const fuzzyMatches = [];
    for (const entry of gazetteer) {
        const dist = levenshtein(barangayLower, entry.name.toLowerCase());
        if (dist <= 2) {
            fuzzyMatches.push({ entry, distance: dist });
        }
    }
    if (fuzzyMatches.length === 1) {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const { entry, distance: dist } = fuzzyMatches[0];
        return {
            confidence: dist <= 1 ? 'medium' : 'low',
            parsed: {
                reportType,
                barangay: entry.name,
                details,
            },
            candidates: [],
            autoReplyText: buildAutoReply(dist <= 1 ? 'medium' : 'low'),
        };
    }
    if (fuzzyMatches.length > 1) {
        fuzzyMatches.sort((a, b) => a.distance - b.distance);
        const candidates = fuzzyMatches.slice(0, 3).map((m) => m.entry.name);
        return {
            confidence: 'low',
            parsed: null,
            candidates,
            autoReplyText: buildAutoReply('low'),
        };
    }
    return {
        confidence: 'none',
        parsed: null,
        candidates: [],
        autoReplyText: buildAutoReply('none'),
    };
}
//# sourceMappingURL=parser.js.map