import type { UserRole } from '@bantayog/shared-types';
export interface FirebaseWebEnv {
    apiKey: string;
    authDomain: string;
    projectId: string;
    appId: string;
    messagingSenderId: string;
    storageBucket: string;
    databaseURL: string;
    appCheckSiteKey: string;
}
export declare function parseFirebaseWebEnv(source: Record<string, string | undefined>): FirebaseWebEnv;
export declare function getSessionTimeoutMs(role: UserRole): number | null;
//# sourceMappingURL=env.d.ts.map