import type { SmsProvider } from '../sms-provider.js';
export type ProviderMode = 'fake' | 'real' | 'disabled';
export declare function getProviderMode(): ProviderMode;
export declare function resolveProvider(target: 'semaphore' | 'globelabs'): SmsProvider;
//# sourceMappingURL=factory.d.ts.map