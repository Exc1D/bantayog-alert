import { type Firestore } from 'firebase-admin/firestore';
export interface UpdateMunicipalityContactDeps {
    municipalityId: string;
    mdrrmoLabel: string;
    mdrrmoHotline: string;
    actor: {
        uid: string;
        claims: {
            role?: string;
            municipalityId?: string;
        };
    };
    now: number;
}
export declare function updateMunicipalityContactCore(db: Firestore, deps: UpdateMunicipalityContactDeps): Promise<{
    municipalityId: string;
    mdrrmoLabel: string;
    mdrrmoHotline: string;
    updatedAt: number;
}>;
export declare const updateMunicipalityContact: import("firebase-functions/https").CallableFunction<unknown, Promise<{
    municipalityId: string;
    mdrrmoLabel: string;
    mdrrmoHotline: string;
    updatedAt: number;
}>, unknown>;
//# sourceMappingURL=update-municipality-contact.d.ts.map