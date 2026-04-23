export class SmsProviderRetryableError extends Error {
    kind;
    constructor(message, kind) {
        super(message);
        this.kind = kind;
        this.name = 'SmsProviderRetryableError';
    }
}
export class SmsProviderNotImplementedError extends Error {
    constructor(providerId) {
        super(`${providerId} provider is not implemented in Phase 4a`);
        this.name = 'SmsProviderNotImplementedError';
    }
}
//# sourceMappingURL=sms-provider.js.map