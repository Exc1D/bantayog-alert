export type SmsPurpose = 'receipt_ack' | 'verification' | 'status_update' | 'resolution' | 'pending_review' | 'mass_alert';
export type SmsLocale = 'tl' | 'en';
export declare class SmsTemplateError extends Error {
    constructor(message: string);
}
export type DirectSmsPurpose = Exclude<SmsPurpose, 'mass_alert'>;
interface RenderArgs {
    purpose: DirectSmsPurpose;
    locale: SmsLocale;
    vars: {
        publicRef: string;
    };
}
export declare function renderTemplate(args: RenderArgs): string;
interface BroadcastRenderArgs {
    locale: SmsLocale;
    vars: {
        municipalityName: string;
        body: string;
    };
}
export declare function renderBroadcastTemplate(args: BroadcastRenderArgs): string;
export {};
//# sourceMappingURL=sms-templates.d.ts.map