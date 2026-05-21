import type { Firestore } from 'firebase-admin/firestore';
export interface MunicipalityLookup {
    label(id: string): Promise<string>;
}
export declare function createMunicipalityLookup(db: Firestore): MunicipalityLookup;
//# sourceMappingURL=municipality-lookup.d.ts.map