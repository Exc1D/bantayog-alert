import { enqueueSms } from '../services/send-sms.js';
export function enqueueDispatchSms(args) {
    const { db, tx, reportId, dispatchId, recipientMsisdn, locale, publicRef, salt, nowMs } = args;
    enqueueSms(db, tx, {
        reportId,
        dispatchId,
        purpose: 'status_update',
        recipientMsisdn,
        locale,
        publicRef,
        salt,
        nowMs,
        providerId: 'semaphore',
    });
}
//# sourceMappingURL=dispatch-responder-notify.js.map