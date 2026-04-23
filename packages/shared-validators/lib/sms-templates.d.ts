export type SmsPurpose = 'receipt_ack' | 'verification' | 'status_update' | 'resolution' | 'pending_review';
export type SmsLocale = 'tl' | 'en';
export declare class SmsTemplateError extends Error {
    constructor(message: string);
}
interface RenderArgs {
    purpose: SmsPurpose;
    locale: SmsLocale;
    vars: {
        publicRef: string;
    };
}
export declare function renderTemplate(args: RenderArgs): string;
export {};
//# sourceMappingURL=sms-templates.d.ts.map