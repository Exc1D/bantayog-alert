import { timingSafeEqual } from 'node:crypto';
import { onRequest } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import { logDimension } from '@bantayog/shared-validators';
const log = logDimension('smsDeliveryReport');
function constantTimeEquals(a, b) {
    if (a.length !== b.length)
        return false;
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    return timingSafeEqual(bufA, bufB);
}
export async function smsDeliveryReportCore(args) {
    const { db, headers, body, now, expectedSecret } = args;
    const provided = headers['x-sms-provider-secret'] ?? '';
    if (!expectedSecret || !constantTimeEquals(provided, expectedSecret)) {
        log({ severity: 'WARNING', code: 'sms.webhook.auth_failed', message: 'bad secret' });
        return { status: 401, body: { error: 'unauthorized' } };
    }
    if (typeof body !== 'object' || body === null) {
        return { status: 400, body: { error: 'bad body' } };
    }
    const { providerMessageId, status } = body;
    if (!providerMessageId || (status !== 'delivered' && status !== 'failed')) {
        return { status: 400, body: { error: 'bad body' } };
    }
    const querySnap = await db
        .collection('sms_outbox')
        .where('providerMessageId', '==', providerMessageId)
        .limit(1)
        .get();
    if (querySnap.empty) {
        log({ severity: 'INFO', code: 'sms.webhook.unknown_message', message: providerMessageId });
        return { status: 200, body: { ok: true } };
    }
    const doc = querySnap.docs[0];
    if (!doc) {
        return { status: 200, body: { ok: true } };
    }
    const data = doc.data();
    if (data.status === 'delivered' || data.status === 'failed' || data.status === 'abandoned') {
        log({
            severity: 'INFO',
            code: 'sms.webhook.callback_after_terminal',
            message: providerMessageId,
            data: { currentStatus: data.status },
        });
        return { status: 200, body: { ok: true } };
    }
    const nowMs = now();
    if (status === 'delivered') {
        await doc.ref.update({
            status: 'delivered',
            deliveredAt: nowMs,
            recipientMsisdn: null,
        });
        log({ severity: 'INFO', code: 'sms.delivered', message: providerMessageId });
    }
    else {
        await doc.ref.update({
            status: 'failed',
            failedAt: nowMs,
            terminalReason: 'dlr_failed',
            recipientMsisdn: null,
        });
        log({ severity: 'INFO', code: 'sms.dlr_failed', message: providerMessageId });
    }
    return { status: 200, body: { ok: true } };
}
export const smsDeliveryReport = onRequest({ region: 'asia-southeast1', maxInstances: 20, timeoutSeconds: 30 }, async (req, res) => {
    const result = await smsDeliveryReportCore({
        db: getFirestore(),
        headers: req.headers,
        body: req.body,
        now: () => Date.now(),
        expectedSecret: process.env.SMS_WEBHOOK_INBOUND_SECRET ?? '',
    });
    res.status(result.status).json(result.body ?? { ok: true });
});
//# sourceMappingURL=sms-delivery-report.js.map