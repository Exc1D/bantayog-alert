import type { Firestore } from 'firebase-admin/firestore';
import type { Database } from 'firebase-admin/database';
export interface EligibleResponder {
    uid: string;
    displayName: string;
    agencyId: string;
    municipalityId: string;
}
export declare function getEligibleResponders(db: Firestore, rtdb: Database, filter: {
    municipalityId: string;
    agencyId?: string;
}): Promise<EligibleResponder[]>;
//# sourceMappingURL=responder-eligibility.d.ts.map