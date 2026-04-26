import { createHash } from 'node:crypto';
import { detectEncoding, hashMsisdn, renderTemplate, renderBroadcastTemplate, } from '@bantayog/shared-validators';
function buildIdempotencyKey(args) {
    const raw = args.purpose === 'status_update'
        ? `${args.dispatchId ?? ''}:${args.purpose}`
        : `${args.reportId}:${args.purpose}`;
    return createHash('sha256').update(raw).digest('hex');
}
// 'mass_alert' is intentionally excluded — broadcast SMS uses enqueueBroadcastSms/renderBroadcastTemplate.
const VALID_PURPOSES = new Set([
    'receipt_ack',
    'verification',
    'status_update',
    'resolution',
    'pending_review',
]);
export function buildEnqueueSmsPayload(args) {
    if (!VALID_PURPOSES.has(args.purpose)) {
        throw new Error(`Unsupported purpose in Phase 4a: ${args.purpose}`);
    }
    const body = renderTemplate({
        purpose: args.purpose,
        locale: args.locale,
        vars: { publicRef: args.publicRef },
    });
    const { encoding, segmentCount } = detectEncoding(body);
    const bodyPreviewHash = createHash('sha256').update(body).digest('hex');
    const recipientMsisdnHash = hashMsisdn(args.recipientMsisdn, args.salt);
    const idempotencyKey = buildIdempotencyKey(args);
    return {
        providerId: args.providerId,
        recipientMsisdnHash,
        recipientMsisdn: args.recipientMsisdn,
        purpose: args.purpose,
        predictedEncoding: encoding,
        predictedSegmentCount: segmentCount,
        bodyPreviewHash,
        status: 'queued',
        idempotencyKey,
        retryCount: 0,
        locale: args.locale,
        reportId: args.reportId,
        createdAt: args.nowMs,
        queuedAt: args.nowMs,
        schemaVersion: 2,
    };
}
export function enqueueSms(db, tx, args) {
    const payload = buildEnqueueSmsPayload(args);
    const outboxRef = db.collection('sms_outbox').doc(payload.idempotencyKey);
    tx.set(outboxRef, payload, { merge: true });
    return { outboxId: payload.idempotencyKey, outboxRef };
}
export function enqueueBroadcastSms(db, tx, args) {
    const body = renderBroadcastTemplate({ locale: args.locale, vars: args.vars });
    const { encoding, segmentCount } = detectEncoding(body);
    const recipientMsisdnHash = hashMsisdn(args.recipientMsisdn, args.salt);
    const raw = `mass_alert:${args.massAlertRequestId}:${args.recipientMsisdn}`;
    const idempotencyKey = createHash('sha256').update(raw).digest('hex');
    const payload = {
        providerId: args.providerId,
        recipientMsisdnHash,
        recipientMsisdn: args.recipientMsisdn,
        purpose: 'mass_alert',
        predictedEncoding: encoding,
        predictedSegmentCount: segmentCount,
        bodyPreviewHash: createHash('sha256').update(body).digest('hex'),
        status: 'queued',
        idempotencyKey,
        retryCount: 0,
        locale: args.locale,
        massAlertRequestId: args.massAlertRequestId,
        createdAt: args.nowMs,
        queuedAt: args.nowMs,
        schemaVersion: 2,
    };
    const outboxRef = db.collection('sms_outbox').doc(idempotencyKey);
    tx.set(outboxRef, payload, { merge: true });
    return { outboxId: idempotencyKey };
}
//# sourceMappingURL=send-sms.js.map