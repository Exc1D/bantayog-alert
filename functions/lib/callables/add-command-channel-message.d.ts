import { Timestamp } from 'firebase-admin/firestore';
export interface AddCommandChannelMessageDeps {
    threadId: string;
    body: string;
    idempotencyKey: string;
    actor: {
        uid: string;
        claims: {
            role: string;
            accountStatus: string;
        };
    };
    now: Timestamp;
}
export declare function addCommandChannelMessageCore(db: FirebaseFirestore.Firestore, deps: AddCommandChannelMessageDeps): Promise<{
    status: 'sent';
}>;
export declare const addCommandChannelMessage: import("firebase-functions/https").CallableFunction<any, Promise<{
    status: "sent";
}>, unknown>;
//# sourceMappingURL=add-command-channel-message.d.ts.map