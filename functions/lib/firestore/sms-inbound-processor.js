import { createDecipheriv } from 'node:crypto';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { getFirestore } from 'firebase-admin/firestore';
import { randomBytes } from 'node:crypto';
import { parseInboundSms } from '@bantayog/shared-sms-parser';
import { processInboxItemCore } from '../triggers/process-inbox-item.js';
import { enqueueSms } from '../services/send-sms.js';
import { BantayogError, logDimension } from '@bantayog/shared-validators';
const log = logDimension('smsInboundProcessor');
const ENCRYPTION_KEY = process.env.SMS_MSISDN_ENCRYPTION_KEY ?? '';
function generatePublicRef() {
    return randomBytes(6).toString('base64url').replace(/\+/g, '0').replace(/\//g, '0').slice(0, 8);
}
function decryptMsisdn(encrypted) {
    if (!encrypted.startsWith('unencrypted:')) {
        const key = Buffer.from(ENCRYPTION_KEY, 'hex');
        const parsed = JSON.parse(encrypted);
        const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(parsed.iv, 'hex'));
        decipher.setAuthTag(Buffer.from(parsed.tag, 'hex'));
        const decrypted = Buffer.concat([
            decipher.update(Buffer.from(parsed.ct, 'hex')),
            decipher.final(),
        ]);
        return decrypted.toString('utf8');
    }
    return encrypted.slice('unencrypted:'.length);
}
export const smsInboundProcessor = onDocumentCreated({
    document: 'sms_inbox/{msgId}',
    region: 'asia-southeast1',
    timeoutSeconds: 60,
    memory: '512MiB',
}, async (event) => {
    const msgId = event.params.msgId;
    const db = getFirestore();
    if (!event.data) {
        log({ severity: 'ERROR', code: 'trigger.no_data', message: 'event.data is undefined' });
        return;
    }
    const snap = await event.data.ref.get();
    const data = snap.data();
    if (!data) {
        log({ severity: 'ERROR', code: 'trigger.no_data', message: 'snap.data() is undefined' });
        return;
    }
    if (data.parseStatus !== 'pending') {
        log({
            severity: 'INFO',
            code: 'skip.already_processed',
            message: `msgId ${msgId} already processed`,
        });
        return;
    }
    let publicRef = '';
    let inboxId = '';
    try {
        const parseResult = parseInboundSms(data.body);
        const { parsed, confidence } = parseResult;
        if (confidence === 'none' || !parsed) {
            await event.data.ref.update({ parseStatus: 'unparseable' });
            log({ severity: 'INFO', code: 'parse.none', message: `msgId ${msgId} unparseable` });
            return;
        }
        publicRef = generatePublicRef();
        inboxId = `sms-${msgId}`;
        const correlationId = `sms:${msgId}`;
        await db
            .collection('report_inbox')
            .doc(inboxId)
            .set({
            reporterUid: `sms:${msgId}`,
            clientCreatedAt: data.receivedAt,
            idempotencyKey: inboxId,
            publicRef,
            secretHash: randomBytes(32).toString('hex'),
            correlationId,
            payload: {
                reportType: parsed.reportType,
                description: parsed.details ?? `SMS: ${parsed.reportType} at ${parsed.barangay}`,
                severity: 'medium',
                source: 'sms',
            },
            schemaVersion: 1,
        });
        const coreResult = await processInboxItemCore({ db, inboxId });
        await event.data.ref.update({
            parseStatus: confidence === 'low' ? 'low_confidence' : 'parsed',
            parsedIntoInboxId: coreResult.reportId,
            confidenceScore: confidence === 'high' ? 1 : confidence === 'medium' ? 0.7 : 0.4,
        });
        const senderMsisdnEnc = data.senderMsisdnEnc;
        const senderMsisdnHash = data.senderMsisdnHash;
        if (senderMsisdnEnc && !senderMsisdnHash.startsWith('invalid:')) {
            const recipientMsisdn = decryptMsisdn(senderMsisdnEnc);
            const salt = process.env.SMS_MSISDN_HASH_SALT ?? '';
            // eslint-disable-next-line @typescript-eslint/require-await
            await db.runTransaction(async (tx) => {
                enqueueSms(db, tx, {
                    reportId: coreResult.reportId,
                    purpose: 'receipt_ack',
                    recipientMsisdn,
                    locale: 'tl',
                    publicRef: coreResult.publicRef,
                    salt,
                    nowMs: Date.now(),
                    providerId: 'globelabs',
                });
            });
            log({
                severity: 'INFO',
                code: 'auto_reply.queued',
                message: `Auto-reply queued for ${msgId}`,
            });
        }
    }
    catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        const isLocationError = err instanceof BantayogError &&
            (err.message === 'location missing from payload' || err.message === 'out of jurisdiction');
        if (isLocationError) {
            await event.data.ref.update({ parseStatus: 'pending_review' });
            const senderMsisdnEnc = data.senderMsisdnEnc;
            const senderMsisdnHash = data.senderMsisdnHash;
            if (senderMsisdnEnc && !senderMsisdnHash.startsWith('invalid:')) {
                let recipientMsisdn = null;
                try {
                    recipientMsisdn = decryptMsisdn(senderMsisdnEnc);
                }
                catch {
                    log({
                        severity: 'WARNING',
                        code: 'decrypt.failed',
                        message: `MSISDN decryption failed for ${msgId} — skipping pending_review reply`,
                    });
                }
                if (recipientMsisdn) {
                    const salt = process.env.SMS_MSISDN_HASH_SALT ?? '';
                    try {
                        // eslint-disable-next-line @typescript-eslint/require-await
                        await db.runTransaction(async (tx) => {
                            enqueueSms(db, tx, {
                                reportId: inboxId,
                                purpose: 'pending_review',
                                recipientMsisdn,
                                locale: 'tl',
                                publicRef,
                                salt,
                                nowMs: Date.now(),
                                providerId: 'globelabs',
                            });
                        });
                        log({
                            severity: 'INFO',
                            code: 'auto_reply.pending_review.queued',
                            message: `pending_review reply queued for ${msgId}`,
                        });
                    }
                    catch (replyErr) {
                        log({
                            severity: 'WARNING',
                            code: 'auto_reply.pending_review.failed',
                            message: `pending_review enqueue failed for ${msgId}: ${replyErr instanceof Error ? replyErr.message : String(replyErr)}`,
                        });
                    }
                }
            }
        }
        else {
            await event.data.ref.update({ parseStatus: 'unparseable' });
            log({
                severity: 'ERROR',
                code: 'trigger.error',
                message: `msgId ${msgId}: ${errorMessage}`,
            });
        }
    }
});
//# sourceMappingURL=sms-inbound-processor.js.map