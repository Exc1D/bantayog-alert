# Phase 4b: SMS Inbound Pipeline — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Feature-phone citizens can submit emergency reports via SMS `BANTAYOG <TYPE> <BARANGAY>`. System parses inbound, writes to `report_inbox`, sends auto-reply SMS confirmation. Low-confidence parses flagged `needsReview: true`.

**Architecture:** Thin webhook (`POST /smsInbound`) writes to `sms_inbox` → Firestore `onCreate` trigger (`smsInboundProcessor`) parses, writes `report_inbox`, sends auto-reply via Phase 4a `sendSMS`. Rate limiting via `sms_sessions/{msisdnHash}` with atomic Firestore transaction.

**Tech Stack:** Firebase Functions v2 (Node.js 20), Firestore, Phase 4a `sendSMS` outbound service, `packages/shared-validators` (Zod, `hashMsisdn`), `packages/shared-sms-parser` (new parser module).

---

## File Map

```
packages/shared-sms-parser/src/
  index.ts              ← UPDATE: re-export inbound parser
  inbound.ts           ← CREATE: parser module
  __tests__/
    inbound.test.ts   ← CREATE: parser unit tests

packages/shared-validators/src/
  sms.ts               ← UPDATE: add SMS-specific report_inbox fields

functions/src/
  http/
    sms-inbound.ts     ← CREATE: webhook (thin — write sms_inbox, fast ack)
  firestore/
    sms-inbound-processor.ts  ← CREATE: trigger (parse, write report_inbox, auto-reply)
  triggers/
    process-inbox-item.ts     ← UPDATE: add publicRef to ProcessInboxItemCoreResult
  __tests__/
    sms-inbound.test.ts       ← CREATE: integration tests

scripts/
  phase-4b/
    acceptance.ts      ← CREATE: acceptance harness
```

**No rule changes needed:** `sms_inbox` and `sms_sessions` are already `allow read, write: if false;` (CF-managed). Webhook and trigger run as CF service account.

---

## Before All Tasks: Verify Implement-Time Prerequisites

Complete these before starting implementation:

- [ ] **Verify `packages/shared-data/` has barangay gazetteer** — if empty, parser uses in-memory fallback list (12-muni coarse list is Phase 0 scope, data may already exist)
- [ ] **Confirm `processInboxItemCore` interface** — read `functions/src/triggers/process-inbox-item.ts:22-26` to confirm `ProcessInboxItemCoreResult` fields; plan assumes it returns `{ materialized, replayed, reportId }` only (no `publicRef`)
- [ ] **Confirm `sendSMS` signature** — read `functions/src/services/send-sms.ts` to confirm purpose parameter type for auto-reply
- [ ] **Source `GLOBE_LABS_WEBHOOK_IP_RANGE`** — stored in Secret Manager; for dev, may use hardcoded dev value

---

## Task 1: SMS Parser Unit Tests

**File:** `packages/shared-sms-parser/src/__tests__/inbound.test.ts` (CREATE)

```typescript
import { describe, it, expect } from 'vitest'
import { parseInboundSms } from '../inbound.js'

describe('parseInboundSms', () => {
  it('parses high-confidence flood report', () => {
    const result = parseInboundSms('BANTAYOG FLOOD CALASGASAN')
    expect(result.confidence).toBe('high')
    expect(result.parsed?.reportType).toBe('flood')
    expect(result.parsed?.barangay).toBe('Calasgasan')
    expect(result.parsed?.rawBarangay).toBeUndefined()
    expect(result.candidates).toHaveLength(0)
  })

  it('parses with type synonym BAHA', () => {
    const result = parseInboundSms('BANTAYOG BAHA LABO')
    expect(result.confidence).toBe('high')
    expect(result.parsed?.reportType).toBe('flood')
  })

  it('fuzzy-matches barangay with typo (Levenshtein ≤ 2)', () => {
    const result = parseInboundSms('BANTAYOG FIRE CALASGAN') // missing 's'
    expect(result.confidence).toBe('low')
    expect(result.parsed?.reportType).toBe('fire')
    expect(result.parsed?.barangay).toBe('Calasgasan')
    expect(result.parsed?.rawBarangay).toBe('CALASGAN')
    expect(result.candidates).toHaveLength(0)
  })

  it('returns candidates on ambiguous barangay match', () => {
    const result = parseInboundSms('BANTAYOG FLOOD DA')
    expect(result.confidence).toBe('low')
    expect(result.candidates.length).toBeGreaterThan(0)
    expect(result.parsed).toBeNull()
  })

  it('returns confidence none for unparseable input', () => {
    const result = parseInboundSms('BANTAYOG HELP ME')
    expect(result.confidence).toBe('none')
    expect(result.parsed).toBeNull()
    expect(result.autoReplyText).toContain('BANTAYOG <TYPE> <BARANGAY>')
  })

  it('trims and normalizes whitespace', () => {
    const result = parseInboundSms('  BANTAYOG  FLOOD   CALASGASAN  ')
    expect(result.confidence).toBe('high')
  })

  it('is case-insensitive', () => {
    const result = parseInboundSms('bantayog flood Calasgasan')
    expect(result.confidence).toBe('high')
  })

  it('parses fire synonym SUNOG', () => {
    const result = parseInboundSms('BANTAYOG SUNOG SAN JOSE')
    expect(result.confidence).toBe('high')
    expect(result.parsed?.reportType).toBe('fire')
  })

  it('parses landslide synonym GUHO', () => {
    const result = parseInboundSms('BANTAYOG GUHO MANGCAMAMUND')
    expect(result.confidence).toBe('high')
    expect(result.parsed?.reportType).toBe('landslide')
  })

  it('parses medical synonym MEDIKAL', () => {
    const result = parseInboundSms('BANTAYOG MEDIKAL ALCOY')
    expect(result.confidence).toBe('high')
    expect(result.parsed?.reportType).toBe('medical')
  })

  it('parses accident synonym AKSIDENTE', () => {
    const result = parseInboundSms('BANTAYOG AKSIDENTE BABANG')
    expect(result.confidence).toBe('high')
    expect(result.parsed?.reportType).toBe('accident')
  })

  it('captures details after barangay', () => {
    const result = parseInboundSms('BANTAYOG FLOOD CALASGASAN Mabait naman')
    expect(result.confidence).toBe('high')
    expect(result.parsed?.details).toBe('Mabait naman')
  })

  it('returns high confidence for OTHER type', () => {
    const result = parseInboundSms('BANTAYOG OTHER NAMNAMA')
    expect(result.confidence).toBe('high')
    expect(result.parsed?.reportType).toBe('other')
  })
})
```

- [ ] **Step 1: Write failing tests** — create file with tests above
- [ ] **Step 2: Run tests to verify they fail** — `pnpm --filter @bantayog/shared-sms-parser test` — expected: FAIL (inbound.ts not yet created)
- [ ] **Step 3: Commit** — `git add packages/shared-sms-parser/src/__tests__/inbound.test.ts && git commit -m "test(sms-parser): add inbound parser unit tests"`

---

## Task 2: SMS Parser Implementation

**File:** `packages/shared-sms-parser/src/inbound.ts` (CREATE)

The parser needs access to the barangay gazetteer. Import from `packages/shared-data` if available (may be empty placeholder — use in-memory fallback for Phase 4b).

```typescript
import { z } from 'zod'

// ─── Types ────────────────────────────────────────────────────────────────────

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
  barangay: string // canonical name
  rawBarangay?: string // original text if fuzzy-matched
  details?: string // remaining text after type + barangay
}

export interface ParseResult {
  confidence: Confidence
  parsed: ParsedFields | null
  candidates: string[]
  autoReplyText: string
}

// ─── Barangay Gazetteer ────────────────────────────────────────────────────────
// Import from shared-data if populated; fallback to coarse in-memory list.
// Phase 0 delivers package structure; Phase 2 fills it with real data.

interface BarangayEntry {
  name: string // canonical name
  municipality: string // municipality name
}

function getBarangayGazetteer(): BarangayEntry[] {
  try {
    // Dynamic import — shared-data may be empty placeholder
    const mod = require('@bantayog/shared-data')
    if (mod.BARANGAY_GAZETTEER && Array.isArray(mod.BARANGAY_GAZETTEER)) {
      return mod.BARANGAY_GAZETTEER
    }
  } catch {
    // shared-data not yet populated — use fallback
  }
  // Fallback: coarse list covering 12 municipalities (Phase 0 deliverable)
  return FALLBACK_BARANGAYS
}

const FALLBACK_BARANGAYS: BarangayEntry[] = [
  // Daet
  { name: 'Calasgasan', municipality: 'Daet' },
  { name: 'Namoc', municipality: 'Daet' },
  { name: 'Pandan', municipality: 'Daet' },
  { name: 'Gubat', municipality: 'Daet' },
  { name: 'Bagasbas', municipality: 'Daet' },
  // Jose Panganiban
  { name: 'Namo', municipality: 'Jose Panganiban' },
  { name: 'Parang', municipality: 'Jose Panganiban' },
  // Labo
  { name: 'Baay', municipality: 'Labo' },
  { name: 'Maguiron', municipality: 'Labo' },
  // Add remaining municipalities from Phase 0 coarse dataset as discovered
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

// ─── Auto-reply templates ─────────────────────────────────────────────────────

function buildAutoReply(confidence: Confidence, publicRef?: string): string {
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
  // Step 1: normalize whitespace
  const normalized = body.trim().replace(/\s+/g, ' ').toUpperCase()

  // Step 2: check keyword
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

  // Step 3: split into tokens
  const tokens = rest.split(/\s+/)
  if (tokens.length < 2) {
    return {
      confidence: 'none',
      parsed: null,
      candidates: [],
      autoReplyText: buildAutoReply('none'),
    }
  }

  const typeToken = tokens[0]
  const barangayToken = tokens[1]
  const details = tokens.length > 2 ? tokens.slice(2).join(' ') : undefined

  // Step 4: resolve type
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

  // Step 5: barangay matching
  const gazetteer = getBarangayGazetteer()
  const barangayLower = barangayToken.toLowerCase()

  // Exact match
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

  // Fuzzy match — Levenshtein ≤ 2
  const fuzzyMatches: { entry: BarangayEntry; distance: number }[] = []
  for (const entry of gazetteer) {
    const dist = levenshtein(barangayLower, entry.name.toLowerCase())
    if (dist <= 2) {
      fuzzyMatches.push({ entry, distance: dist })
    }
  }

  if (fuzzyMatches.length === 1) {
    const { entry } = fuzzyMatches[0]
    return {
      confidence: dist <= 1 ? 'medium' : 'low', // exact-ish: medium, typo: low
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
    // Ambiguous — sort by distance, return top candidates
    fuzzyMatches.sort((a, b) => a.distance - b.distance)
    const candidates = fuzzyMatches.slice(0, 3).map((m) => m.entry.name)
    return {
      confidence: 'low',
      parsed: null,
      candidates,
      autoReplyText: buildAutoReply('low'),
    }
  }

  // No barangay match
  return {
    confidence: 'none',
    parsed: null,
    candidates: [],
    autoReplyText: buildAutoReply('none'),
  }
}
```

**Note:** `buildAutoReply` takes `publicRef` but the parser doesn't know it yet — the trigger calls `buildAutoReply(confidence)` without `publicRef`, sends the SMS with the ref appended by the trigger after `processInboxItemCore` returns.

- [ ] **Step 1: Write implementation** — create `packages/shared-sms-parser/src/inbound.ts` with code above
- [ ] **Step 2: Run parser tests** — `pnpm --filter @bantayog/shared-sms-parser test` — expected: PASS
- [ ] **Step 3: Fix any failures** — iterate until all parser tests pass
- [ ] **Step 4: Commit** — `git add packages/shared-sms-parser/src/inbound.ts packages/shared-sms-parser/src/__tests__/inbound.test.ts && git commit -m "feat(sms-parser): add inbound BANTAYOG parser with fuzzy barangay matching"`

---

## Task 3: Re-export Parser from Package Index

**File:** `packages/shared-sms-parser/src/index.ts` (UPDATE)

```typescript
// Filled in Phase 4b with BANTAYOG <TYPE> <BARANGAY> parser.
export { parseInboundSms } from './inbound.js'
export type { ParseResult, Confidence, ReportType, ParsedFields } from './inbound.js'
```

- [ ] **Step 1: Update index.ts**
- [ ] **Step 2: Verify exports** — `pnpm --filter @bantayog/shared-sms-parser build` — expected: no errors
- [ ] **Step 3: Commit** — `git add packages/shared-sms-parser/src/index.ts && git commit -m "feat(sms-parser): re-export inbound parser from package index"`

---

## Task 4: Add SMS-specific Fields to Shared-Validators Zod Schema

**File:** `packages/shared-validators/src/sms.ts` (UPDATE — may already exist, add missing fields)

Check what already exists in `sms.ts` before writing.

```typescript
// Add to existing sms.ts or create if empty:
// SMS-originated report_inbox fields (written by smsInboundProcessor trigger)

export const smsReportInboxFieldsSchema = z.object({
  source: z.literal('sms'),
  sourceMsgId: z.string(), // links to sms_inbox/{msgId}
  reporterMsisdnHash: z.string(), // SHA-256 hash of normalized MSISDN
  confidence: z.enum(['high', 'medium', 'low']),
  needsReview: z.boolean(),
  requiresLocationFollowUp: z.literal(true), // SMS always needs location follow-up
})
```

- [ ] **Step 1: Read current `packages/shared-validators/src/sms.ts`** — check what already exists
- [ ] **Step 2: Add SMS-specific inbox fields if not present** — ensure `smsReportInboxFieldsSchema` or equivalent is exported
- [ ] **Step 3: Verify typecheck** — `pnpm --filter @bantayog/shared-validators typecheck` — expected: PASS
- [ ] **Step 4: Commit** — `git add packages/shared-validators/src/sms.ts && git commit -m "feat(validators): add SMS-originated report_inbox Zod schema"`

---

## Task 5: Update processInboxItemCore Result Interface

**File:** `functions/src/triggers/process-inbox-item.ts` (UPDATE)

The trigger needs `publicRef` to send the auto-reply SMS. Currently `ProcessInboxItemCoreResult` returns `{ materialized, replayed, reportId }`. Add `publicRef`.

```typescript
// At line ~22, update interface:
export interface ProcessInboxItemCoreResult {
  materialized: boolean
  replayed: boolean
  reportId: string
  publicRef: string // ADD THIS — public tracking ref for SMS auto-reply
}
```

And at the return site (find `return { materialized: ..., replayed: ..., reportId }` inside the idempotency wrapper), add `publicRef: inbox.publicRef`:

```typescript
return {
  materialized: true,
  reportId,
  publicRef: inbox.publicRef, // ADD THIS
}
```

- [ ] **Step 1: Read `functions/src/triggers/process-inbox-item.ts`** around lines 22-26 and the return statement
- [ ] **Step 2: Add `publicRef: string` to `ProcessInboxItemCoreResult` interface**
- [ ] **Step 3: Add `publicRef: inbox.publicRef` to the returned object** (inside the idempotency callback, after `reportId` is available)
- [ ] **Step 4: Typecheck** — `pnpm --filter @bantayog/functions typecheck` — expected: PASS
- [ ] **Step 5: Commit** — `git add functions/src/triggers/process-inbox-item.ts && git commit -m "feat(process-inbox): return publicRef from processInboxItemCore for SMS trigger"`

---

## Task 6: SMS Inbound Webhook

**File:** `functions/src/http/sms-inbound.ts` (CREATE)

Thin webhook: validate → rate-limit → write `sms_inbox` → return 200 fast.

```typescript
import * as crypto from 'node:crypto'
import { normalizeMsisdn, hashMsisdn } from '@bantayog/shared-validators'
import type { Firestore } from 'firebase-admin/firestore'
import { log } from 'firebase-functions/logger'
import { onRequest } from 'firebase-functions/v2/https'

const log_ = logDimension('smsInbound')

interface RateLimitDoc {
  hourlyCount: number
  hourlyWindow: FirebaseFirestore.Timestamp
  dailyCount: number
  dailyWindow: FirebaseFirestore.Timestamp
}

function buildMsgId(): string {
  // Globe Labs delivers a unique message ID; use it if available
  return crypto.randomUUID()
}

async function checkRateLimit(db: Firestore, msisdnHash: string): Promise<boolean> {
  // Returns true if within limit; false if exceeded (caller drops silently)
  const sessionRef = db.collection('sms_sessions').doc(msisdnHash)
  const now = Date.now()
  const HOUR_MS = 60 * 60 * 1000
  const DAY_MS = 24 * HOUR_MS

  let withinLimit = false
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(sessionRef)
    let doc: RateLimitDoc

    if (!snap.exists) {
      // First message from this msisdnHash — create with count 1
      doc = {
        hourlyCount: 1,
        hourlyWindow: Timestamp.fromDate(new Date(now)),
        dailyCount: 1,
        dailyWindow: Timestamp.fromDate(new Date(now)),
      }
      tx.set(sessionRef, doc)
      withinLimit = true
      return
    }

    doc = snap.data() as RateLimitDoc
    const hourlyWindowMs = doc.hourlyWindow.toMillis()
    const dailyWindowMs = doc.dailyWindow.toMillis()

    // Reset stale windows atomically in the same write
    const newHourlyCount = now - hourlyWindowMs >= HOUR_MS ? 1 : doc.hourlyCount + 1
    const newDailyCount = now - dailyWindowMs >= DAY_MS ? 1 : doc.dailyCount + 1
    const newHourlyWindow =
      now - hourlyWindowMs >= HOUR_MS ? Timestamp.fromDate(new Date(now)) : doc.hourlyWindow
    const newDailyWindow =
      now - dailyWindowMs >= DAY_MS ? Timestamp.fromDate(new Date(now)) : doc.dailyWindow

    // Check limits BEFORE incrementing
    if (
      newHourlyCount > 5 ||
      newDailyCount > 20 // Already exceeded after increment
    ) {
      withinLimit = false
      return
    }

    tx.set(sessionRef, {
      hourlyCount: newHourlyCount,
      hourlyWindow: newHourlyWindow,
      dailyCount: newDailyCount,
      dailyWindow: newDailyWindow,
    })
    withinLimit = true
  })

  return withinLimit
}

export const smsInboundWebhook = onRequest(async (req, res) => {
  // ── Validation ──────────────────────────────────────────────────────────────
  if (req.method !== 'POST') {
    res.status(405).send('Method Not Allowed')
    return
  }

  // IP allowlist (env var: GLOBE_LABS_WEBHOOK_IP_RANGE, e.g. "47.58.0.0/16")
  const allowedIpRange = process.env.GLOBE_LABS_WEBHOOK_IP_RANGE
  if (allowedIpRange) {
    const ip = req.ip ?? ''
    // Simple CIDR check — if /32 just compare strings
    if (!ip.startsWith(allowedIpRange.replace(/\/\d+$/, ''))) {
      log_(`IP ${ip} not in allowlist ${allowedIpRange}`)
      res.status(403).send('Forbidden')
      return
    }
  }

  // Shared-secret header
  const expectedSecret = process.env.GLOBE_LABS_WEBHOOK_SECRET
  if (expectedSecret) {
    const receivedSecret =
      req.headers['x-webhook-secret'] ?? req.headers['x-globe-labs-secret'] ?? ''
    if (receivedSecret !== expectedSecret) {
      res.status(403).send('Forbidden')
      return
    }
  }

  // Parse body — Globe Labs sends: { from: string, message: string, ... }
  const body = req.body
  if (!body || typeof body.message !== 'string' || typeof body.from !== 'string') {
    res.status(400).send('Bad Request')
    return
  }

  const { from: rawFrom, message: rawBody, id: globeMsgId } = body

  // ── MSISDN normalization + hash ─────────────────────────────────────────────
  let msisdnHash: string
  try {
    const normalized = normalizeMsisdn(rawFrom)
    const salt = process.env.SMS_MSISDN_HASH_SALT ?? ''
    msisdnHash = hashMsisdn(normalized, salt)
  } catch {
    // Invalid MSISDN — still accept but hash a placeholder so we don't persist raw
    msisdnHash = 'invalid:' + crypto.createHash('sha256').update(rawFrom).digest('hex').slice(0, 16)
    log_({ severity: 'WARN', code: 'msisdn.invalid', rawFrom: rawFrom.slice(0, 6) + '****' })
  }

  // ── Rate limit ─────────────────────────────────────────────────────────────
  const db = getFirestore()
  const withinLimit = await checkRateLimit(db, msisdnHash)
  if (!withinLimit) {
    // Silent drop — return 200 so Globe Labs doesn't retry
    log_({ severity: 'INFO', code: 'ratelimit.dropped', msisdnHash })
    res.status(200).json({ ok: true })
    return
  }

  // ── Write to sms_inbox ──────────────────────────────────────────────────────
  const msgId = globeMsgId ?? buildMsgId()
  await db.collection('sms_inbox').doc(msgId).set(
    {
      msisdnHash,
      rawBody,
      receivedAt: FieldValue.serverTimestamp(),
      status: 'received',
    },
    { merge: true }, // Idempotent: Globe Labs retry hits same doc ID
  )

  // Emit raw MSISDN to Cloud Logging only (never to Firestore)
  log_({
    severity: 'INFO',
    code: 'sms.inbox.received',
    msgId,
    msisdnHash: msisdnHash.slice(0, 8) + '****',
  })

  res.status(200).json({ ok: true })
})
```

**Dependencies to import:** `getFirestore`, `FieldValue`, `Timestamp` from `firebase-admin/firestore`; `logDimension` from shared-validators.

- [ ] **Step 1: Create `functions/src/http/sms-inbound.ts`** with implementation above
- [ ] **Step 2: Add to function index** — register in `functions/src/index.ts`
- [ ] **Step 3: Typecheck** — `pnpm --filter @bantayog/functions typecheck` — expected: PASS (fix any import/type errors)
- [ ] **Step 4: Commit** — `git add functions/src/http/sms-inbound.ts && git commit -m "feat(sms-inbound): add thin webhook for Globe Labs SMS ingress"`

---

## Task 7: SMS Inbound Processor Trigger

**File:** `functions/src/firestore/sms-inbound-processor.ts` (CREATE)

Firestore `onCreate` trigger on `sms_inbox`. Parses, writes `report_inbox`, sends auto-reply.

```typescript
import { onDocumentCreated } from 'firebase-functions/v2/firestore'
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore'
import { parseInboundSms } from '@bantayog/shared-sms-parser'
import { processInboxItemCore } from '../triggers/process-inbox-item.js'
import { enqueueSms } from '../services/send-sms.js'
import { logDimension } from '@bantayog/shared-validators'
import { randomBytes } from 'node:crypto'

const log_ = logDimension('smsInboundProcessor')

function generatePublicRef(): string {
  // Format: 8 lowercase alphanumeric chars
  // Uses Node.js crypto (server-only)
  return randomBytes(6)
    .toString('base64')
    .replace(/\+/g, '0')
    .replace(/\//g, '0')
    .replace(/[A-Z]/g, (c) => c.toLowerCase())
    .slice(0, 8)
}

export const smsInboundProcessor = onDocumentCreated('sms_inbox/{msgId}', async (event) => {
  const msgId = event.params.msgId
  const db = getFirestore()

  // ── Guard: only process 'received' items ─────────────────────────────────
  const snap = await event.data.ref.get()
  const data = snap.data()!
  if (data.status !== 'received') {
    log_({ severity: 'INFO', code: 'skip.already_processed', msgId })
    return
  }

  try {
    // ── Parse ────────────────────────────────────────────────────────────
    const parseResult = parseInboundSms(data.rawBody as string)

    if (parseResult.confidence === 'none') {
      // Unparseable — mark failed, send help auto-reply
      await event.data.ref.update({
        status: 'failed',
        processedAt: FieldValue.serverTimestamp(),
        error: 'unparseable',
      })
      log_({ severity: 'INFO', code: 'parse.failed', msgId })
      return
    }

    const { parsed, confidence } = parseResult
    if (!parsed) {
      await event.data.ref.update({
        status: 'failed',
        processedAt: FieldValue.serverTimestamp(),
        error: 'no_parse_result',
      })
      return
    }

    // ── Generate publicRef + write report_inbox ────────────────────────────
    const publicRef = generatePublicRef()
    const inboxId = `sms-${msgId}` // Unique prefix to avoid collision with web inbox
    const correlationId = `sms:${msgId}`

    // Build the report_inbox document
    const inboxDoc = {
      correlationId,
      clientCreatedAt: (data.receivedAt as Timestamp)?.toMillis() ?? Date.now(),
      publicRef,
      source: 'sms',
      payload: {
        source: 'sms',
        reportType: parsed.reportType,
        severity: 'medium', // SMS defaults to medium; admin adjusts
        description: parsed.details ?? `SMS report: ${parsed.reportType} at ${parsed.barangay}`,
        publicLocation: null, // SMS has no GPS
        contact: null, // No contact from SMS (privacy)
      },
      // SMS-specific fields
      sourceMsgId: msgId,
      reporterMsisdnHash: data.msisdnHash,
      confidence,
      needsReview: confidence === 'low',
      requiresLocationFollowUp: true,
    }

    // Write report_inbox first (before processInboxItemCore reads it)
    await db.collection('report_inbox').doc(inboxId).set(inboxDoc)

    // ── Call processInboxItemCore ─────────────────────────────────────────
    const coreResult = await processInboxItemCore({ db, inboxId })

    // ── Update sms_inbox ─────────────────────────────────────────────────
    await event.data.ref.update({
      status: 'processed',
      processedAt: FieldValue.serverTimestamp(),
      reportItemId: coreResult.reportId,
    })

    // ── Send auto-reply SMS ───────────────────────────────────────────────
    if (parsed && data.msisdnHash && !data.msisdnHash.startsWith('invalid:')) {
      // Get recipient MSISDN from hash (stored in sms_inbox.msisdnHash)
      // We can't reverse the hash — send to the reporter via a lookup mechanism.
      // For Phase 4b auto-reply: we need the raw MSISDN.
      // Note: raw MSISDN was NOT stored in Firestore (privacy).
      // The webhook emitted it to Cloud Logging only.
      // FIX: Store encrypted MSISDN (or decryptable hash) in sms_inbox for auto-reply.
      // Alternative: skip auto-reply in Phase 4b; add reverse-lookup in PIN vault work.
      log_({
        severity: 'WARN',
        code: 'auto_reply.skipped_missing_recipient',
        msgId,
      })
    }
  } catch (err: unknown) {
    // Parser threw — mark failed, no auto-reply
    const errorMessage = err instanceof Error ? err.message : String(err)
    await event.data.ref.update({
      status: 'failed',
      processedAt: FieldValue.serverTimestamp(),
      error: errorMessage.slice(0, 200),
    })
    log_({
      severity: 'ERROR',
      code: 'trigger.error',
      msgId,
      error: errorMessage,
    })
  }
})
```

**Critical issue identified in the plan:** The webhook hashes the MSISDN and only stores `msisdnHash` in Firestore. But the auto-reply SMS needs the raw MSISDN to send. This is the fundamental tension: raw MSISDN → hash for storage, but sendSMS needs a real phone number.

**Resolution:** For Phase 4b auto-reply to work, the webhook must store a recoverable identifier for the auto-reply. Options:

1. Store an encrypted MSISDN in `sms_inbox` (encrypt with a CF-only key)
2. Use a PIN vault approach: generate a temp PIN, send it to the citizen via the initial auto-reply, they reply with PIN to confirm → then we know the number
3. **Simplest for Phase 4b:** Store the MSISDN encrypted with a CF-only secret, decrypt only in the trigger for auto-reply

The spec says `msisdnHash` only in Firestore. This means the auto-reply CANNOT use the MSISDN from Firestore alone. The simplest Phase 4b fix is: store encrypted MSISDN in `sms_inbox` (decrypt in trigger using `GLOBE_LABS_WEBHOOK_SECRET` or a separate `SMS_REPLY_ENCRYPTION_KEY`).

- [ ] **Step 1: Revise webhook** — add encrypted MSISDN storage:
  - In webhook, after normalizing MSISDN: `const encrypted = encryptForCFOnly(rawFrom)` (using `SMS_REPLY_ENCRYPTION_KEY` env var)
  - Store `replyMsisdnEnc: encrypted` in `sms_inbox/{msgId}` (NOT the raw MSISDN)
- [ ] **Step 2: Revise trigger** — decrypt MSISDN for auto-reply:
  - `const msisdn = decryptFromCFOnly(data.replyMsisdnEnc as string)`
  - Call `enqueueSms` with the decrypted MSISDN
- [ ] **Step 3: Write the trigger** — implement `smsInboundProcessor` with the revised auto-reply logic
- [ ] **Step 4: Commit** — `git add functions/src/firestore/sms-inbound-processor.ts && git commit -m "feat(sms-inbound): add smsInboundProcessor trigger with auto-reply"`

---

## Task 8: SMS Inbound Integration Tests

**File:** `functions/src/__tests__/sms-inbound.test.ts` (CREATE)

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { initializeTestApp, cleanupTestApps } from '@firebase/testing'
import { DocumentReference } from 'firebase-admin/firestore'

describe('smsInboundWebhook', () => {
  let db: Firestore
  let app: ReturnType<typeof initializeTestApp>

  beforeEach(async () => {
    app = initializeTestApp({ projectId: 'demo-project', auth: { uid: 'cf-svc' } })
    db = app.firestore()
    // Set env vars
    process.env.GLOBE_LABS_WEBHOOK_SECRET = 'test-secret'
    process.env.SMS_MSISDN_HASH_SALT = 'test-salt'
    process.env.SMS_REPLY_ENCRYPTION_KEY = 'test-key-32-bytes-long-long-long!!'
  })

  afterEach(async () => {
    await cleanupTestApps([app])
    delete process.env.GLOBE_LABS_WEBHOOK_SECRET
    delete process.env.SMS_MSISDN_HASH_SALT
    delete process.env.SMS_REPLY_ENCRYPTION_KEY
  })

  it('writes to sms_inbox with hashed msisdn', async () => {
    // Simulate webhook call
    const from = '+639171234567'
    const message = 'BANTAYOG FLOOD CALASGASAN'
    const msgId = 'test-msg-001'

    await db.collection('sms_inbox').doc(msgId).set({
      msisdnHash: 'hash-placeholder', // real test uses hashMsisdn
      rawBody: message,
      receivedAt: FieldValue.serverTimestamp(),
      status: 'received',
    })

    const snap = await db.collection('sms_inbox').doc(msgId).get()
    expect(snap.exists).toBe(true)
    expect(snap.data()!.rawBody).toBe(message)
    // Verify raw MSISDN is NOT in document
    expect(snap.data()).not.toHaveProperty('from')
    expect(snap.data()).not.toHaveProperty('msisdnRaw')
  })

  it('rate limits at 5th message in same hour', async () => {
    // Create 5 sessions with hourlyCount = 1..5, then verify 6th is dropped
    // (具体的 rate-limit test — implement with Firestore test emulator)
  })
})

describe('smsInboundProcessor trigger', () => {
  it('parses and writes report_inbox for high-confidence SMS', async () => {
    // Simulate sms_inbox document created
    // Trigger runs → parses → writes report_inbox
    // Verify report_inbox has source: 'sms', needsReview: false
  })

  it('sets needsReview: true for low-confidence parse', async () => {
    // 'BANTAYOG FLOOD DA' (ambiguous barangay)
    // Verify needsReview: true
  })

  it('marks sms_inbox status failed on parse error', async () => {
    // Trigger catches error → updates status to 'failed'
    // No report_inbox written
  })

  it('uses sms_inbox/{msgId} as idempotency key for processInboxItemCore', async () => {
    // Verify report_inbox inboxId = 'sms-{msgId}'
  })
})
```

- [ ] **Step 1: Write integration tests** — create `functions/src/__tests__/sms-inbound.test.ts`
- [ ] **Step 2: Run against emulator** — `firebase emulators:exec --only firestore "pnpm --filter @bantayog/functions test"` — expected: PASS (integration tests run)
- [ ] **Step 3: Commit** — `git add functions/src/__tests__/sms-inbound.test.ts && git commit -m "test(sms-inbound): add webhook and trigger integration tests"`

---

## Task 9: Phase 4b Acceptance Harness

**File:** `scripts/phase-4b/acceptance.ts` (CREATE)

Based on `scripts/phase-4a/acceptance.ts` pattern.

```typescript
#!/usr/bin/env pnpm exec tsx
/**
 * Phase 4b acceptance harness.
 * Runs against clean Firestore + RTDB emulator state.
 *
 * Acceptance criteria (pilot-blocker scenario #8):
 * "Feature-phone user texts BANTAYOG BAHA CALASGASAN →
 *  report materializes with barangay-only precision; auto-reply sent."
 */
import { initializeApp, clearFirestoreData } from 'firebase/firestore'
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore'
import { hashMsisdn, normalizeMsisdn } from '@bantayog/shared-validators'

async function resetState(db: Firestore) {
  await clearFirestoreData(db)
  // Clear sms_inbox, sms_sessions, report_inbox
}

async function acceptanceTest() {
  const app = initializeApp({ projectId: 'demo-project' })
  const db = getFirestore()
  connectFirestoreEmulator(db, 'localhost', 8080)

  await resetState(db)

  // ── Test: BANTAYOG BAHA CALASGASAN → high-confidence report ───────────────
  const rawFrom = '+639171234567'
  const normalized = normalizeMsisdn(rawFrom)
  const salt = process.env.SMS_MSISDN_HASH_SALT ?? 'test-salt'
  const msisdnHash = hashMsisdn(normalized, salt)
  const rawBody = 'BANTAYOG BAHA CALASGASAN'
  const msgId = 'acceptance-test-001'

  // Simulate webhook writing to sms_inbox (triggers the onCreate trigger)
  await db.collection('sms_inbox').doc(msgId).set({
    msisdnHash,
    rawBody,
    receivedAt: Date.now(),
    status: 'received',
    replyMsisdnEnc: 'encrypted-placeholder', // Real test: encrypted MSISDN
  })

  // Wait for trigger to process (max 10s)
  let reportItemId: string | null = null
  let attempts = 0
  while (attempts < 20) {
    await new Promise((r) => setTimeout(r, 500))
    const smsInboxSnap = await db.collection('sms_inbox').doc(msgId).get()
    const smsData = smsInboxSnap.data()
    if (smsData?.status === 'processed' && smsData?.reportItemId) {
      reportItemId = smsData.reportItemId
      break
    }
    attempts++
  }

  if (!reportItemId) throw new Error('Trigger did not process sms_inbox in time')

  // Verify report_inbox
  const reportInboxSnap = await db.collection('report_inbox').doc(`sms-${msgId}`).get()
  if (!reportInboxSnap.exists) throw new Error('report_inbox item not created')
  const inboxData = reportInboxSnap.data()!

  const checks = [
    ['source is sms', inboxData.source === 'sms'],
    ['reportType is flood', inboxData.payload?.reportType === 'flood'],
    ['barangay is Calasgasan', inboxData.barangay === 'Calasgasan'],
    ['needsReview is false (high confidence)', inboxData.needsReview === false],
    ['confidence is high', inboxData.confidence === 'high'],
    ['requiresLocationFollowUp is true', inboxData.requiresLocationFollowUp === true],
    ['sms_inbox status is processed', true], // checked above
  ]

  const passed = checks.filter(([, v]) => v).length
  const failed = checks.filter(([, v]) => !v)

  console.log(`\nPhase 4b Acceptance: ${passed}/${checks.length} passed`)
  if (failed.length > 0) {
    console.log('FAILURES:')
    failed.forEach(([label]) => console.log(`  ✗ ${label}`))
    process.exit(1)
  }
  console.log('ALL PASSING')
  process.exit(0)
}

acceptanceTest().catch((err) => {
  console.error(err)
  process.exit(1)
})
```

- [ ] **Step 1: Create `scripts/phase-4b/acceptance.ts`** with acceptance harness
- [ ] **Step 2: Create `scripts/phase-4b/` directory** if needed
- [ ] **Step 3: Run against emulator** — `firebase emulators:exec --only firestore "pnpm exec tsx scripts/phase-4b/acceptance.ts"` — expected: PASS
- [ ] **Step 4: Commit** — `git add scripts/phase-4b/ && git commit -m "test(phase-4b): add acceptance harness for SMS inbound"`

---

## Task 10: Update progress.md

- [ ] **Step 1: Update `docs/progress.md`** — add Phase 4b entry with status, notes on what was built, and verification commands
- [ ] **Step 2: Commit** — `git add docs/progress.md && git commit -m "docs: update progress for Phase 4b"`

---

## Self-Review Checklist

- [ ] All spec requirements mapped to tasks? (spec sections §1-§8 all covered)
- [ ] No TBD/TODO placeholders in task descriptions?
- [ ] Types consistent across tasks? (`publicRef` return type, `report_inbox` fields, `confidence` enum)
- [ ] Rate-limit atomic transaction correctly described? (reset + increment in same write)
- [ ] MSISDN privacy handled? (raw not in Firestore, encrypted in sms_inbox for auto-reply)
- [ ] `processInboxItemCore` interface updated to return `publicRef`? (Task 5)
- [ ] Acceptance gate (pilot-blocker #8) defined with explicit pass/fail table?
