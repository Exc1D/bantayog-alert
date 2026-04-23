import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { getDatabase } from 'firebase-admin/database';
const app = getApps()[0] ?? initializeApp();
export const adminAuth = getAuth(app);
export const adminDb = getFirestore(app);
export const rtdb = getDatabase(app);
//# sourceMappingURL=admin-init.js.map