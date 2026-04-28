/**
 * RTDB security rules tests for §5.8 responder telemetry and projection rules.
 *
 * Uses the compat database API: context.database().ref(path).set(data) / .once('value')
 *
 * Emulators required:
 *   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080
 *   FIREBASE_DATABASE_EMULATOR_HOST=127.0.0.1:9000
 *
 * Note: initializes only firestore + database emulators (storage not needed here).
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { assertFails, assertSucceeds, initializeTestEnvironment, } from '@firebase/rules-unit-testing';
import { afterAll, beforeAll, describe, it } from 'vitest';
let env;
// Test UIDs
const RESPONDER_UID = 'responder-1';
const OTHER_RESPONDER_UID = 'responder-2';
const SUPERADMIN_UID = 'superadmin-1';
const DAET_ADMIN_UID = 'daet-admin';
const SV_ADMIN_UID = 'sv-admin';
const PDRRMO_ADMIN_UID = 'pdrrmo-admin';
const BFP_ADMIN_UID = 'bfp-admin';
const CITIZEN_UID = 'citizen-1';
// Minimal valid telemetry payload satisfying all .validate fields
function validPayload(capturedAt) {
    return {
        capturedAt,
        lat: 14.0931,
        lng: 122.9544,
        accuracy: 5.0,
        batteryPct: 80,
        motionState: 'moving',
        appVersion: '1.0.0',
        telemetryStatus: 'active',
    };
}
beforeAll(async () => {
    env = await initializeTestEnvironment({
        projectId: 'demo-rtdb-rules',
        firestore: {
            rules: readFileSync(resolve(process.cwd(), '../infra/firebase/firestore.rules'), 'utf8'),
        },
        database: {
            rules: readFileSync(resolve(process.cwd(), '../infra/firebase/database.rules.json'), 'utf8'),
        },
    });
    // Seed responder_index data (bypasses rules so we can read it in write rules)
    // and responder_locations seed data for read tests
    await env.withSecurityRulesDisabled(async (ctx) => {
        const db = ctx.database();
        // responder_index for RESPONDER_UID — used by muni_admin / agency_admin read checks
        await db.ref(`responder_index/${RESPONDER_UID}`).set({
            municipalityId: 'daet',
            agencyId: 'pdrrmo',
        });
        // seed a valid location for responder-1 so read tests have data
        await db.ref(`responder_locations/${RESPONDER_UID}`).set(validPayload(Date.now()));
        // seed shared_projection data for muni admin tests
        await db.ref(`shared_projection/daet/${RESPONDER_UID}`).set({ lat: 14.0931, lng: 122.9544 });
    });
});
afterAll(async () => {
    await env.cleanup();
});
// ---------------------------------------------------------------------------
// responder_locations WRITE rules
// ---------------------------------------------------------------------------
describe('responder_locations write', () => {
    it('allows responder to write own location with valid capturedAt', async () => {
        const db = env
            .authenticatedContext(RESPONDER_UID, { role: 'responder', accountStatus: 'active' })
            .database();
        await assertSucceeds(db.ref(`responder_locations/${RESPONDER_UID}`).set(validPayload(Date.now())));
    });
    it('blocks write when capturedAt is more than 60 s in the future', async () => {
        const db = env
            .authenticatedContext(RESPONDER_UID, { role: 'responder', accountStatus: 'active' })
            .database();
        // now + 70 000 ms exceeds the <= now + 60 000 guard
        await assertFails(db.ref(`responder_locations/${RESPONDER_UID}`).set(validPayload(Date.now() + 70_000)));
    });
    it('blocks write when capturedAt is older than 60 seconds', async () => {
        const db = env
            .authenticatedContext(RESPONDER_UID, { role: 'responder', accountStatus: 'active' })
            .database();
        // now - 70 000 ms violates the >= now - 60 000 guard
        await assertFails(db.ref(`responder_locations/${RESPONDER_UID}`).set(validPayload(Date.now() - 70_000)));
    });
    it('blocks a non-responder role from writing to responder_locations', async () => {
        const db = env
            .authenticatedContext(CITIZEN_UID, { role: 'citizen', accountStatus: 'active' })
            .database();
        await assertFails(db.ref(`responder_locations/${CITIZEN_UID}`).set(validPayload(Date.now())));
    });
    it('blocks a responder from writing to another responder node', async () => {
        const db = env
            .authenticatedContext(RESPONDER_UID, { role: 'responder', accountStatus: 'active' })
            .database();
        // RESPONDER_UID trying to write to OTHER_RESPONDER_UID's node
        await assertFails(db.ref(`responder_locations/${OTHER_RESPONDER_UID}`).set(validPayload(Date.now())));
    });
    it('blocks a suspended responder from writing', async () => {
        const db = env
            .authenticatedContext(RESPONDER_UID, { role: 'responder', accountStatus: 'suspended' })
            .database();
        await assertFails(db.ref(`responder_locations/${RESPONDER_UID}`).set(validPayload(Date.now())));
    });
});
// ---------------------------------------------------------------------------
// responder_locations READ rules
// ---------------------------------------------------------------------------
describe('responder_locations read', () => {
    it('allows a responder to read own location', async () => {
        const db = env
            .authenticatedContext(RESPONDER_UID, { role: 'responder', accountStatus: 'active' })
            .database();
        await assertSucceeds(db.ref(`responder_locations/${RESPONDER_UID}`).once('value'));
    });
    it('allows provincial_superadmin to read any responder location', async () => {
        const db = env
            .authenticatedContext(SUPERADMIN_UID, {
            role: 'provincial_superadmin',
            accountStatus: 'active',
        })
            .database();
        await assertSucceeds(db.ref(`responder_locations/${RESPONDER_UID}`).once('value'));
    });
    it('allows municipal_admin whose municipalityId matches responder_index to read', async () => {
        // RESPONDER_UID's responder_index.municipalityId = 'daet'
        const db = env
            .authenticatedContext(DAET_ADMIN_UID, {
            role: 'municipal_admin',
            accountStatus: 'active',
            municipalityId: 'daet',
        })
            .database();
        await assertSucceeds(db.ref(`responder_locations/${RESPONDER_UID}`).once('value'));
    });
    it('blocks municipal_admin whose municipalityId does not match', async () => {
        // SV_ADMIN has municipalityId: 'san-vicente'; RESPONDER_UID is indexed to 'daet'
        const db = env
            .authenticatedContext(SV_ADMIN_UID, {
            role: 'municipal_admin',
            accountStatus: 'active',
            municipalityId: 'san-vicente',
        })
            .database();
        await assertFails(db.ref(`responder_locations/${RESPONDER_UID}`).once('value'));
    });
    it('allows agency_admin whose agencyId matches responder_index to read', async () => {
        // RESPONDER_UID's responder_index.agencyId = 'pdrrmo'
        const db = env
            .authenticatedContext(PDRRMO_ADMIN_UID, {
            role: 'agency_admin',
            accountStatus: 'active',
            agencyId: 'pdrrmo',
        })
            .database();
        await assertSucceeds(db.ref(`responder_locations/${RESPONDER_UID}`).once('value'));
    });
    it('blocks agency_admin whose agencyId does not match', async () => {
        // BFP_ADMIN has agencyId: 'bfp'; RESPONDER_UID is indexed to 'pdrrmo'
        const db = env
            .authenticatedContext(BFP_ADMIN_UID, {
            role: 'agency_admin',
            accountStatus: 'active',
            agencyId: 'bfp',
        })
            .database();
        await assertFails(db.ref(`responder_locations/${RESPONDER_UID}`).once('value'));
    });
});
// ---------------------------------------------------------------------------
// responder_index — always denied to clients
// ---------------------------------------------------------------------------
describe('responder_index client access', () => {
    it('blocks any authenticated client read on responder_index', async () => {
        const db = env
            .authenticatedContext(SUPERADMIN_UID, {
            role: 'provincial_superadmin',
            accountStatus: 'active',
        })
            .database();
        await assertFails(db.ref(`responder_index/${RESPONDER_UID}`).once('value'));
    });
    it('blocks any authenticated client write on responder_index', async () => {
        const db = env
            .authenticatedContext(SUPERADMIN_UID, {
            role: 'provincial_superadmin',
            accountStatus: 'active',
        })
            .database();
        await assertFails(db.ref(`responder_index/${RESPONDER_UID}`).set({ municipalityId: 'injected' }));
    });
});
// ---------------------------------------------------------------------------
// shared_projection — read by role, writes always denied
// ---------------------------------------------------------------------------
describe('shared_projection access', () => {
    it('allows matching municipal_admin to read shared_projection/{municipalityId}', async () => {
        const db = env
            .authenticatedContext(DAET_ADMIN_UID, {
            role: 'municipal_admin',
            accountStatus: 'active',
            municipalityId: 'daet',
        })
            .database();
        await assertSucceeds(db.ref(`shared_projection/daet/${RESPONDER_UID}`).once('value'));
    });
    it('blocks municipal_admin with mismatched municipalityId from reading', async () => {
        // SV_ADMIN token.municipalityId = 'san-vicente' !== $municipalityId 'daet'
        const db = env
            .authenticatedContext(SV_ADMIN_UID, {
            role: 'municipal_admin',
            accountStatus: 'active',
            municipalityId: 'san-vicente',
        })
            .database();
        await assertFails(db.ref(`shared_projection/daet/${RESPONDER_UID}`).once('value'));
    });
    it('blocks any client write to shared_projection', async () => {
        const db = env
            .authenticatedContext(SUPERADMIN_UID, {
            role: 'provincial_superadmin',
            accountStatus: 'active',
        })
            .database();
        await assertFails(db.ref(`shared_projection/daet/${RESPONDER_UID}`).set({ lat: 99, lng: 99 }));
    });
    it('blocks any client write to shared_projection parent path', async () => {
        const db = env
            .authenticatedContext(SUPERADMIN_UID, {
            role: 'provincial_superadmin',
            accountStatus: 'active',
        })
            .database();
        await assertFails(db.ref(`shared_projection/daet`).set({ [RESPONDER_UID]: { lat: 99, lng: 99 } }));
    });
});
//# sourceMappingURL=rtdb.rules.test.js.map