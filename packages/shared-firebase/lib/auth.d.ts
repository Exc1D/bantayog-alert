import { type Auth, type User } from 'firebase/auth';
import type { FirebaseApp } from 'firebase/app';
export declare function ensurePseudonymousSignIn(auth: Auth): Promise<User>;
export declare function getFirebaseAuth(app: FirebaseApp): Auth;
export declare function subscribeAuth(auth: Auth, callback: (user: User | null) => void): () => void;
//# sourceMappingURL=auth.d.ts.map