// TICKET(BANTAYOG-PHASE6): move TEMPLATES to Firestore for CMS-driven editing.
// This requires an admin UI, caching strategy, and fallback chain — defer until post-MVP.
export class SmsTemplateError extends Error {
    constructor(message) {
        super(message);
        this.name = 'SmsTemplateError';
    }
}
const TEMPLATES = {
    receipt_ack: {
        tl: 'Natanggap ang iyong report. Reference: {publicRef}. Maaaring makatanggap ka pa ng SMS update.',
        en: 'Your report has been received. Reference: {publicRef}. You may receive additional SMS updates.',
    },
    verification: {
        tl: 'Nakumpirma ang iyong report (ref {publicRef}). Kasalukuyan nang pinag-aaralan ng aming team.',
        en: 'Your report (ref {publicRef}) has been verified. Our team is now reviewing it.',
    },
    status_update: {
        tl: 'Ipinadala na ang responder sa iyong report (ref {publicRef}). Manatiling ligtas.',
        en: 'A responder has been dispatched to your report (ref {publicRef}). Please stay safe.',
    },
    resolution: {
        tl: 'Isinara na ang iyong report (ref {publicRef}). Salamat sa iyong pag-uulat.',
        en: 'Your report (ref {publicRef}) has been closed. Thank you for reporting.',
    },
    pending_review: {
        tl: 'Natanggap ang iyong report. Ang aming team ay magsasagawa ng verification. Manatiling ligtas.',
        en: 'Your report has been received. Our team will review and follow up with you. Please stay safe.',
    },
};
const PUBLIC_REF_RE = /^[a-z0-9]{8}$/;
export function renderTemplate(args) {
    const purposeMap = TEMPLATES[args.purpose];
    // purposeMap is Record<SmsLocale, string>|undefined per TS, but runtime may differ
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (!purposeMap) {
        throw new SmsTemplateError(`Unknown purpose: ${args.purpose}`);
    }
    const template = purposeMap[args.locale];
    // purposeMap is Record<SmsLocale, string>|undefined per TS, but runtime may differ
    if (!template) {
        throw new SmsTemplateError(`Unknown locale: ${args.locale}`);
    }
    if (!args.vars.publicRef || !PUBLIC_REF_RE.test(args.vars.publicRef)) {
        throw new SmsTemplateError(`Missing or invalid publicRef`);
    }
    return template.replace('{publicRef}', args.vars.publicRef);
}
//# sourceMappingURL=sms-templates.js.map