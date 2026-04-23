import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
const FIRESTORE_RULES_PATH = resolve(process.cwd(), '../infra/firebase/firestore.rules');
const RTDB_RULES_PATH = resolve(process.cwd(), '../infra/firebase/database.rules.json');
const STORAGE_RULES_PATH = resolve(process.cwd(), '../infra/firebase/storage.rules');
export async function createTestEnv(projectId) {
    return initializeTestEnvironment({
        projectId,
        firestore: {
            rules: readFileSync(FIRESTORE_RULES_PATH, 'utf8'),
        },
        database: {
            rules: readFileSync(RTDB_RULES_PATH, 'utf8'),
        },
        storage: {
            rules: readFileSync(STORAGE_RULES_PATH, 'utf8'),
        },
    });
}
export function authed(env, uid, claims) {
    return env.authenticatedContext(uid, claims).firestore();
}
export function unauthed(env) {
    return env.unauthenticatedContext().firestore();
}
//# sourceMappingURL=rules-harness.js.map