import type { SmsProvider } from '../sms-provider.js';
import { type Firestore } from 'firebase-admin/firestore';
export interface GlobelabsProviderDeps {
    getFirestore?: () => Firestore;
}
export declare function createGlobelabsSmsProvider(deps?: GlobelabsProviderDeps): SmsProvider;
//# sourceMappingURL=globelabs.d.ts.map