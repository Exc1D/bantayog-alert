import type { Firestore } from 'firebase-admin/firestore';
export interface ProcessInboxItemCoreInput {
    db: Firestore;
    inboxId: string;
    now?: () => number;
}
export interface ProcessInboxItemCoreResult {
    materialized: boolean;
    replayed: boolean;
    reportId: string;
    publicRef: string;
}
export declare function processInboxItemCore(input: ProcessInboxItemCoreInput): Promise<ProcessInboxItemCoreResult>;
//# sourceMappingURL=process-inbox-item.d.ts.map