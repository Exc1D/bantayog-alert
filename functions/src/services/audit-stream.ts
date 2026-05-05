/**
 * audit-stream.ts
 *
 * Fire-and-forget audit event streaming to BigQuery.
 * All PRE-7 callables call streamAuditEvent() — never throws.
 * Requires infra: bantayog_audit.streaming_events table — see infra/bigquery/
 */

import { BigQuery } from '@google-cloud/bigquery'
import { adminDb } from '../admin-init.js'

export interface AuditStreamEvent {
  eventType: string
  actorUid: string
  sessionId?: string
  targetCollection?: string
  targetDocumentId?: string
  metadata?: Record<string, unknown>
  occurredAt: number
}

const bq = new BigQuery()
const table = bq.dataset('bantayog_audit').table('streaming_events')

export async function streamAuditEvent(event: AuditStreamEvent): Promise<void> {
  try {
    await table.insert([event])
  } catch (err) {
    console.warn('[audit-stream] failed to stream event', event.eventType, err)
    try {
      await adminDb.collection('dead_letters').add({
        category: 'audit_stream',
        status: 'failed_to_stream',
        payload: event,
        createdAt: Date.now(),
        error: err instanceof Error ? err.message : String(err),
      })
    } catch (dlErr) {
      console.error('[audit-stream] failed to write dead letter', dlErr)
    }
  }
}
