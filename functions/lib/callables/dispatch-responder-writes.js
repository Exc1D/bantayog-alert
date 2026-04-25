import { Timestamp } from 'firebase-admin/firestore';
export async function buildSmsPayload(args) {
    const { db, tx, reportId, salt, defaultPublicRef } = args;
    if (!salt)
        return null;
    const consentSnap = await tx.get(db.collection('report_sms_consent').doc(reportId));
    if (!consentSnap.exists)
        return null;
    const consentData = consentSnap.data();
    if (consentData?.smsConsent !== true)
        return null;
    if (typeof consentData.phone !== 'string')
        return null;
    const recipientMsisdn = consentData.phone.trim();
    if (!recipientMsisdn)
        return null;
    const locale = consentData.locale === 'en' ? 'en' : 'tl';
    const lookupQ = db.collection('report_lookup').where('reportId', '==', reportId).limit(1);
    const lookupSnap = await tx.get(lookupQ);
    const publicRef = lookupSnap.docs[0]?.id ?? defaultPublicRef;
    return { recipientMsisdn, locale, publicRef };
}
export function writeDispatchDocs(args) {
    const { tx, deps, dispatchRef, reportRef, reportEvRef, dispatchEvRef, responder, deadlineMs, correlationId, from, to, } = args;
    const dispatchId = dispatchRef.id;
    tx.set(dispatchRef, {
        dispatchId,
        reportId: deps.reportId,
        status: 'pending',
        assignedTo: {
            uid: deps.responderUid,
            agencyId: responder.agencyId,
            municipalityId: responder.municipalityId,
        },
        dispatchedAt: deps.now,
        dispatchedBy: deps.actor.uid,
        lastStatusAt: deps.now,
        acknowledgementDeadlineAt: Timestamp.fromMillis(deps.now.toMillis() + deadlineMs),
        correlationId,
        schemaVersion: 1,
    });
    tx.update(reportRef, {
        status: to,
        lastStatusAt: deps.now,
        lastStatusBy: deps.actor.uid,
        currentDispatchId: dispatchId,
    });
    tx.set(reportEvRef, {
        eventId: reportEvRef.id,
        reportId: deps.reportId,
        from,
        to,
        actor: deps.actor.uid,
        actorRole: deps.actor.claims.role ?? 'municipal_admin',
        at: deps.now,
        correlationId,
        schemaVersion: 1,
    });
    tx.set(dispatchEvRef, {
        eventId: dispatchEvRef.id,
        dispatchId,
        reportId: deps.reportId,
        from: null,
        to: 'pending',
        actor: deps.actor.uid,
        actorRole: deps.actor.claims.role ?? 'municipal_admin',
        at: deps.now,
        correlationId,
        schemaVersion: 1,
    });
}
//# sourceMappingURL=dispatch-responder-writes.js.map