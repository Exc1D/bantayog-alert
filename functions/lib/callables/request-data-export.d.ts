import { type Firestore } from 'firebase-admin/firestore';
import { type Auth } from 'firebase-admin/auth';
import { type Storage } from 'firebase-admin/storage';
export declare function requestDataExportImpl(db: Firestore, auth: Auth, storage: Storage, actor: {
    uid: string;
}): Promise<{
    downloadUrl: string;
    expiresAt: number;
    reportCount: number;
    mediaCount: number;
}>;
export declare const requestDataExport: import("firebase-functions/https").CallableFunction<any, Promise<{
    downloadUrl: string;
    expiresAt: number;
    reportCount: number;
    mediaCount: number;
}>, unknown>;
//# sourceMappingURL=request-data-export.d.ts.map