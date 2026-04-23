import { type Firestore } from 'firebase-admin/firestore';
export interface RequestLookupInput {
    db: Firestore;
    data: unknown;
}
export interface RequestLookupResult {
    status: string;
    lastStatusAt: number;
    municipalityLabel: string;
}
export declare function requestLookupImpl(input: RequestLookupInput): Promise<RequestLookupResult>;
export declare const requestLookup: import("firebase-functions/https").CallableFunction<any, Promise<RequestLookupResult>, unknown>;
//# sourceMappingURL=request-lookup.d.ts.map