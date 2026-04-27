import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
const FIRESTORE_RULES_PATH = resolve(process.cwd(), '../infra/firebase/firestore.rules');
const RTDB_RULES_PATH = resolve(process.cwd(), '../infra/firebase/database.rules.json');
const STORAGE_RULES_PATH = resolve(process.cwd(), '../infra/firebase/storage.rules');
function extractEmulatorHostPort(emulator) {
    if (!emulator)
        return null;
    const host = emulator.host;
    const port = emulator.port;
    if (typeof port !== 'number' || port <= 0) {
        console.warn(`[rules-harness] skipping emulator with invalid port: ${JSON.stringify(emulator)}`);
        return null;
    }
    return { host, port };
}
function isEmulatorRunning(emulator) {
    if (!emulator)
        return false;
    // If the hub reports a state field, require it to be "running".
    // Absent state field is treated as running (for hub versions that omit it).
    if ('state' in emulator) {
        return emulator.state === 'running';
    }
    return true;
}
const HUB_POLL_URL = 'http://localhost:4400/emulators';
const MAX_HUB_POLL_ATTEMPTS = 30;
const HUB_POLL_INTERVAL_MS = 500;
const HUB_FETCH_TIMEOUT_MS = 500;
const POST_REGISTRATION_DELAY_MS = 2000;
export async function createTestEnv(projectId) {
    // Poll the hub until Firestore registers and is in running state, or time out after MAX_HUB_POLL_ATTEMPTS (15s with 500ms poll).
    let hubData = null;
    let lastHubError = null;
    for (let i = 0; i < MAX_HUB_POLL_ATTEMPTS; i++) {
        try {
            const res = await fetch(HUB_POLL_URL, {
                signal: AbortSignal.timeout(HUB_FETCH_TIMEOUT_MS),
            });
            if (res.ok) {
                hubData = (await res.json());
                // Check both presence AND running state
                if (hubData.firestore && isEmulatorRunning(hubData.firestore))
                    break;
            }
        }
        catch (err) {
            lastHubError = err;
        }
        await new Promise((r) => setTimeout(r, HUB_POLL_INTERVAL_MS));
    }
    if (!hubData?.firestore || !isEmulatorRunning(hubData.firestore)) {
        const lastErrorMsg = lastHubError instanceof Error ? ` Last hub error: ${lastHubError.message}` : '';
        throw new Error('[rules-harness] Firestore emulator did not register with the hub after 15s. ' +
            'Ensure `firebase emulators:exec` is running with `--only firestore` (or `--only firestore,database,storage`).' +
            lastErrorMsg);
    }
    // Even after registration, Firestore needs a moment to start accepting gRPC connections.
    await new Promise((r) => setTimeout(r, POST_REGISTRATION_DELAY_MS));
    // Build config dynamically based on which emulators the hub reports as running.
    // This avoids connection errors when only a subset of emulators is started.
    const config = { projectId };
    const firestoreInfo = extractEmulatorHostPort(hubData.firestore);
    if (firestoreInfo && isEmulatorRunning(hubData.firestore)) {
        config.firestore = {
            host: firestoreInfo.host,
            port: firestoreInfo.port,
            rules: readFileSync(FIRESTORE_RULES_PATH, 'utf8'),
        };
    }
    const databaseInfo = extractEmulatorHostPort(hubData.database);
    if (databaseInfo && isEmulatorRunning(hubData.database)) {
        config.database = {
            host: databaseInfo.host,
            port: databaseInfo.port,
            rules: readFileSync(RTDB_RULES_PATH, 'utf8'),
        };
    }
    const storageInfo = extractEmulatorHostPort(hubData.storage);
    if (storageInfo && isEmulatorRunning(hubData.storage)) {
        config.storage = {
            host: storageInfo.host,
            port: storageInfo.port,
            rules: readFileSync(STORAGE_RULES_PATH, 'utf8'),
        };
    }
    if (Object.keys(config).length === 1) {
        throw new Error('[rules-harness] No emulators reported as running by the hub. ' +
            'Check that the emulator suite started successfully and all requested services are enabled.');
    }
    try {
        return await initializeTestEnvironment(config);
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        throw new Error(`[rules-harness] initializeTestEnvironment failed: ${message}`, { cause: err });
    }
}
export function authed(env, uid, claims) {
    return env.authenticatedContext(uid, claims).firestore();
}
export function unauthed(env) {
    return env.unauthenticatedContext().firestore();
}
//# sourceMappingURL=rules-harness.js.map