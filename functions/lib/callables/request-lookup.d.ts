import { type Firestore } from 'firebase-admin/firestore';
export interface RequestLookupInput {
    db: Firestore;
    data: unknown;
    auth?: {
        uid: string;
    } | undefined;
}
export interface RequestLookupResult {
    publicRef: string;
    status: string;
    lastStatusAt: number;
    municipalityLabel: string;
}
export declare function requestLookupImpl(input: RequestLookupInput): Promise<RequestLookupResult>;
export declare const requestLookup: import("firebase-functions/https").CallableFunction<any, Promise<RequestLookupResult>, unknown>;
//# sourceMappingURL=request-lookup.d.ts.map