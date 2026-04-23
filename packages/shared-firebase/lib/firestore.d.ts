import { type Firestore } from 'firebase/firestore';
import type { FirebaseApp } from 'firebase/app';
import type { AlertDoc, MinAppVersionDoc } from '@bantayog/shared-types';
export declare function getFirebaseDb(app: FirebaseApp): Firestore;
export declare function subscribeMinAppVersion(db: Firestore, callback: (value: MinAppVersionDoc | null) => void): () => void;
export declare function subscribeAlerts(db: Firestore, callback: (value: AlertDoc[]) => void): () => void;
//# sourceMappingURL=firestore.d.ts.map