import type { Firestore } from 'firebase-admin/firestore';
import { type InboxPayload } from '@bantayog/shared-validators';
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
export interface CitizenReportMaterializationInput {
    db: Firestore;
    reporterUid: string;
    clientCreatedAt: number;
    publicRef: string;
    secretHash: string;
    correlationId: string;
    payload: InboxPayload;
    municipalityId: string;
    municipalityLabel: string;
    barangayId: string;
    now?: () => number;
}
export type CitizenReportMaterializationResult = ProcessInboxItemCoreResult;
export declare function materializeCitizenReportCore(input: CitizenReportMaterializationInput): Promise<CitizenReportMaterializationResult>;
export declare function processInboxItemCore(input: ProcessInboxItemCoreInput): Promise<ProcessInboxItemCoreResult>;
//# sourceMappingURL=process-inbox-item.d.ts.map