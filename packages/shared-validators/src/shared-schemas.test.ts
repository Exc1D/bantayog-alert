import { describe, expect, it } from 'vitest'
import { smsInboxDocSchema, smsOutboxDocSchema, smsProviderHealthDocSchema } from './sms.js'
import { agencyAssistanceRequestDocSchema } from './coordination.js'
import { hazardZoneDocSchema } from './hazard.js'
import { incidentResponseEventSchema } from './incident-response.js'
import { moderationIncidentDocSchema } from './moderation.js'
import { rateLimitDocSchema } from './rate-limits.js'
import { idempotencyKeyDocSchema } from './idempotency-keys.js'
import { deadLetterDocSchema } from './dead-letters.js'
import { alertDocSchema } from './alerts-emergencies.js'
import {
  CAMARINES_NORTE_MUNICIPALITIES,
  hazardSignalDocSchema,
  hazardSignalStatusDocSchema,
} from './index.js'

const ts = 1713350400000

describe('sms schemas', () => {
  it('rejects sms outbox without providerId', () => {
    expect(() =>
      smsOutboxDocSchema.parse({
        purpose: 'status_update',
        recipientMsisdnHash: 'a'.repeat(64),
        status: 'queued',
        createdAt: ts,
        schemaVersion: 1,
      }),
    ).toThrow()
  })

  it('accepts canonical inbound sms record', () => {
    expect(
      smsInboxDocSchema.parse({
        providerId: 'globelabs',
        receivedAt: ts,
        senderMsisdnHash: 'a'.repeat(64),
        body: 'BANTAYOG BAHA CALASGASAN',
        parseStatus: 'pending',
        schemaVersion: 1,
      }),
    ).toMatchObject({ providerId: 'globelabs' })
  })

  it('validates provider health enum', () => {
    expect(() =>
      smsProviderHealthDocSchema.parse({
        providerId: 'semaphore',
        circuitState: 'unstable', // invalid
        errorRatePct: 2,
        updatedAt: ts,
      }),
    ).toThrow()
  })
})

describe('coordination schemas', () => {
  it('agency assistance expiresAt must be > createdAt', () => {
    expect(() =>
      agencyAssistanceRequestDocSchema.parse({
        reportId: 'r',
        requestedByMunicipalId: 'a',
        requestedByMunicipality: 'daet',
        targetAgencyId: 'bfp',
        requestType: 'BFP',
        message: 'help',
        priority: 'urgent',
        status: 'pending',
        fulfilledByDispatchIds: [],
        createdAt: ts + 1000,
        expiresAt: ts,
      }),
    ).toThrow()
  })
})

describe('hazard schemas', () => {
  it('hazard zone requires polygonRef and bbox', () => {
    expect(() =>
      hazardZoneDocSchema.parse({
        zoneType: 'reference',
        hazardType: 'flood',
        scope: 'provincial',
        version: 1,
        createdAt: ts,
        updatedAt: ts,
        schemaVersion: 1,
      }),
    ).toThrow()
  })

  it('accepts a manual tcws signal lifecycle document', () => {
    expect(
      hazardSignalDocSchema.parse({
        hazardType: 'tropical_cyclone',
        signalLevel: 4,
        source: 'manual',
        scopeType: 'province',
        affectedMunicipalityIds: CAMARINES_NORTE_MUNICIPALITIES.map((m) => m.id),
        status: 'active',
        validFrom: ts,
        validUntil: ts + 60 * 60 * 1000,
        recordedAt: ts,
        rawSource: 'manual',
        recordedBy: 'super-1',
        reason: 'PAGASA radio confirmation',
        schemaVersion: 1,
      }),
    ).toMatchObject({ status: 'active', signalLevel: 4 })
  })

  it('rejects province scope when affectedMunicipalityIds is empty', () => {
    expect(() =>
      hazardSignalDocSchema.parse({
        hazardType: 'tropical_cyclone',
        signalLevel: 3,
        source: 'manual',
        scopeType: 'province',
        affectedMunicipalityIds: [],
        status: 'active',
        validFrom: ts,
        validUntil: ts + 1,
        recordedAt: ts,
        rawSource: 'manual',
        recordedBy: 'super-1',
        reason: 'test',
        schemaVersion: 1,
      }),
    ).toThrow()
  })

  it('accepts a projected hazard signal status document', () => {
    expect(
      hazardSignalStatusDocSchema.parse({
        active: true,
        effectiveSignalId: 'sig-1',
        effectiveLevel: 4,
        effectiveSource: 'manual',
        scopeType: 'province',
        affectedMunicipalityIds: CAMARINES_NORTE_MUNICIPALITIES.map((m) => m.id),
        effectiveScopes: [
          { municipalityId: 'daet', signalLevel: 4, source: 'manual', signalId: 'sig-1' },
        ],
        validUntil: ts + 60 * 60 * 1000,
        manualOverrideActive: true,
        scraperDegraded: false,
        lastProjectedAt: ts,
        degradedReasons: [],
        schemaVersion: 1,
      }),
    ).toMatchObject({ active: true })
  })
})

describe('rate limit schema', () => {
  it('accepts a window counter', () => {
    expect(
      rateLimitDocSchema.parse({
        key: 'citizen:submit:u-1',
        windowStartAt: ts,
        windowEndAt: ts + 60000,
        count: 3,
        limit: 10,
        updatedAt: ts,
      }),
    ).toMatchObject({ count: 3 })
  })
})

describe('idempotency key schema', () => {
  it('requires 64-char hex hash', () => {
    expect(() =>
      idempotencyKeyDocSchema.parse({
        key: 'k',
        payloadHash: 'short',
        firstSeenAt: ts,
      }),
    ).toThrow()
  })
})

describe('dead letter schema', () => {
  it('accepts a failed inbox item', () => {
    expect(
      deadLetterDocSchema.parse({
        source: 'processInboxItem',
        originalDocRef: 'report_inbox/abc',
        failureReason: 'validation_error',
        payload: { x: 1 },
        attempts: 3,
        firstSeenAt: ts,
        lastSeenAt: ts,
      }),
    ).toMatchObject({ attempts: 3 })
  })
})

describe('alerts/emergencies schemas', () => {
  it('alert requires targetMunicipalityIds array', () => {
    expect(() =>
      alertDocSchema.parse({
        title: 'x',
        body: 'y',
        severity: 'high',
        sentAt: ts,
        publishedBy: 'super-1',
      }),
    ).toThrow()
  })
})

describe('incident response schema', () => {
  it('accepts declaration event', () => {
    expect(
      incidentResponseEventSchema.parse({
        incidentId: 'i-1',
        phase: 'declared',
        actor: 'super-1',
        discoveredAt: ts,
        notes: 'privileged-read anomaly',
        createdAt: ts,
        correlationId: 'c-1',
      }),
    ).toMatchObject({ phase: 'declared' })
  })
})

describe('moderation schema', () => {
  it('rejects unknown source literal', () => {
    expect(() =>
      moderationIncidentDocSchema.parse({
        reason: 'duplicate_spam',
        source: 'email', // invalid
        createdAt: ts,
      }),
    ).toThrow()
  })
})
