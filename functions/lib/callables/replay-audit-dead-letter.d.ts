import { type Firestore } from 'firebase-admin/firestore';
interface ReplayAuditDeadLetterActor {
    uid: string;
    role: string;
}
export declare function replayAuditDeadLetterCore(db: Firestore, actor: ReplayAuditDeadLetterActor): Promise<{
    replayed: number;
}>;
export declare const replayAuditDeadLetter: import("firebase-functions/https").CallableFunction<unknown, Promise<{
    replayed: number;
}>, unknown>;
export {};
//# sourceMappingURL=replay-audit-dead-letter.d.ts.map