import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { getDatabase } from 'firebase-admin/database';
function getFallbackAppConfig() {
    if (process.env.VITEST) {
        const emulatorHost = process.env.FIREBASE_DATABASE_EMULATOR_HOST ?? '127.0.0.1:9000';
        console.warn('[admin-init] VITEST mode: using dummy RTDB URL. Emulator must be running.');
        return { databaseURL: `http://${emulatorHost}?ns=demo` };
    }
    return undefined;
}
const app = getApps()[0] ?? initializeApp(getFallbackAppConfig());
export const adminAuth = getAuth(app);
export const adminDb = getFirestore(app);
export const rtdb = getDatabase(app);
//# sourceMappingURL=admin-init.js.map