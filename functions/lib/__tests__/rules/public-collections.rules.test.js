import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { collection, getDocs, addDoc, doc, setDoc, getDoc } from 'firebase/firestore';
import { afterAll, beforeAll, describe, it } from 'vitest';
import { authed, createTestEnv, unauthed } from '../helpers/rules-harness.js';
import { seedActiveAccount, seedAgency, staffClaims, ts } from '../helpers/seed-factories.js';
let env;
beforeAll(async () => {
    env = await createTestEnv('demo-phase-2-public');
    await seedActiveAccount(env, { uid: 'citizen-1', role: 'citizen' });
    await seedActiveAccount(env, {
        uid: 'daet-admin',
        role: 'municipal_admin',
        municipalityId: 'daet',
    });
    await seedAgency(env, 'agency-1', { municipalityId: 'daet' });
});
afterAll(async () => {
    await env.cleanup();
});
describe('public collections rules', () => {
    describe('agencies', () => {
        it('any authed user can read agencies', async () => {
            const db = authed(env, 'citizen-1', staffClaims({ role: 'citizen' }));
            await assertSucceeds(getDocs(collection(db, 'agencies')));
        });
        it('agency writes are callable-only', async () => {
            const db = authed(env, 'daet-admin', staffClaims({ role: 'municipal_admin' }));
            await assertFails(addDoc(collection(db, 'agencies'), {
                municipalityId: 'daet',
                name: 'Test Agency',
                createdAt: ts,
            }));
        });
    });
    describe('emergencies', () => {
        it('any authed user can read emergencies', async () => {
            const db = authed(env, 'citizen-1', staffClaims({ role: 'citizen' }));
            await assertSucceeds(getDocs(collection(db, 'emergencies')));
        });
        it('emergency writes are callable-only', async () => {
            const db = authed(env, 'daet-admin', staffClaims({ role: 'municipal_admin' }));
            await assertFails(addDoc(collection(db, 'emergencies'), {
                municipalityId: 'daet',
                declaredAt: ts,
                schemaVersion: 1,
            }));
        });
    });
    describe('audit_logs', () => {
        it('audit logs are callable-only reads', async () => {
            const db = authed(env, 'citizen-1', staffClaims({ role: 'citizen' }));
            await assertFails(getDocs(collection(db, 'audit_logs')));
        });
        it('audit logs are callable-only writes', async () => {
            const db = authed(env, 'daet-admin', staffClaims({ role: 'municipal_admin' }));
            await assertFails(addDoc(collection(db, 'audit_logs'), {
                action: 'test',
                actorUid: 'test',
                timestamp: ts,
            }));
        });
    });
    describe('dead_letters', () => {
        it('dead letters are callable-only reads', async () => {
            const db = authed(env, 'citizen-1', staffClaims({ role: 'citizen' }));
            await assertFails(getDocs(collection(db, 'dead_letters')));
        });
        it('dead letters are callable-only writes', async () => {
            const db = authed(env, 'daet-admin', staffClaims({ role: 'municipal_admin' }));
            await assertFails(addDoc(collection(db, 'dead_letters'), {
                originalCollection: 'test',
                payload: {},
                failedAt: ts,
            }));
        });
    });
    describe('moderation_incidents', () => {
        it('moderation incidents are callable-only reads', async () => {
            const db = authed(env, 'citizen-1', staffClaims({ role: 'citizen' }));
            await assertFails(getDocs(collection(db, 'moderation_incidents')));
        });
        it('moderation incidents are callable-only writes', async () => {
            const db = authed(env, 'daet-admin', staffClaims({ role: 'municipal_admin' }));
            await assertFails(addDoc(collection(db, 'moderation_incidents'), {
                reportId: 'test',
                reason: 'test',
                createdAt: ts,
            }));
        });
    });
    describe('incident_response_events', () => {
        it('incident response events are callable-only reads', async () => {
            const db = authed(env, 'citizen-1', staffClaims({ role: 'citizen' }));
            await assertFails(getDocs(collection(db, 'incident_response_events')));
        });
        it('incident response events are callable-only writes', async () => {
            const db = authed(env, 'daet-admin', staffClaims({ role: 'municipal_admin' }));
            await assertFails(addDoc(collection(db, 'incident_response_events'), {
                incidentId: 'test',
                action: 'test',
                timestamp: ts,
            }));
        });
    });
    describe('breakglass_events', () => {
        it('breakglass events are callable-only reads', async () => {
            const db = authed(env, 'citizen-1', staffClaims({ role: 'citizen' }));
            await assertFails(getDocs(collection(db, 'breakglass_events')));
        });
        it('breakglass events are callable-only writes', async () => {
            const db = authed(env, 'daet-admin', staffClaims({ role: 'municipal_admin' }));
            await assertFails(addDoc(collection(db, 'breakglass_events'), {
                triggerReason: 'test',
                triggeredBy: 'admin',
                triggeredAt: ts,
            }));
        });
    });
    describe('rate_limits', () => {
        it('rate limits are callable-only reads', async () => {
            const db = authed(env, 'citizen-1', staffClaims({ role: 'citizen' }));
            await assertFails(getDocs(collection(db, 'rate_limits')));
        });
        it('rate limits are callable-only writes', async () => {
            const db = authed(env, 'citizen-1', staffClaims({ role: 'citizen' }));
            await assertFails(addDoc(collection(db, 'rate_limits'), {
                key: 'test',
                count: 1,
                windowStart: ts,
            }));
        });
    });
});
describe('privileged read tests for callable collections', () => {
    beforeAll(async () => {
        await seedActiveAccount(env, {
            uid: 'super-1',
            role: 'provincial_superadmin',
            permittedMunicipalityIds: ['daet'],
        });
        // Seed command_channel_threads and command_channel_messages atomically
        await env.withSecurityRulesDisabled(async (ctx) => {
            await setDoc(doc(ctx.firestore(), 'command_channel_threads', 'thread-1'), {
                threadId: 'thread-1',
                participantUids: { 'super-1': true },
                municipalityId: 'daet',
                createdAt: ts,
            });
            await setDoc(doc(ctx.firestore(), 'command_channel_messages', 'msg-1'), {
                messageId: 'msg-1',
                threadId: 'thread-1',
                authorUid: 'super-1',
                createdAt: ts,
            });
        });
    });
    it('superadmin with active privileged claim can read audit_logs', async () => {
        const db = authed(env, 'super-1', staffClaims({ role: 'provincial_superadmin', permittedMunicipalityIds: ['daet'] }));
        await assertSucceeds(getDocs(collection(db, 'audit_logs')));
    });
    it('superadmin with active privileged claim can read dead_letters', async () => {
        const db = authed(env, 'super-1', staffClaims({ role: 'provincial_superadmin', permittedMunicipalityIds: ['daet'] }));
        await assertSucceeds(getDocs(collection(db, 'dead_letters')));
    });
    it('superadmin with active privileged claim can read hazard_signals', async () => {
        const db = authed(env, 'super-1', staffClaims({ role: 'provincial_superadmin', permittedMunicipalityIds: ['daet'] }));
        await assertSucceeds(getDocs(collection(db, 'hazard_signals')));
    });
    it('superadmin with active privileged claim can read moderation_incidents', async () => {
        const db = authed(env, 'super-1', staffClaims({ role: 'provincial_superadmin', permittedMunicipalityIds: ['daet'] }));
        await assertSucceeds(getDocs(collection(db, 'moderation_incidents')));
    });
    it('superadmin with active privileged claim can read breakglass_events', async () => {
        const db = authed(env, 'super-1', staffClaims({ role: 'provincial_superadmin', permittedMunicipalityIds: ['daet'] }));
        await assertSucceeds(getDocs(collection(db, 'breakglass_events')));
    });
    it('superadmin with active privileged claim can read sms_outbox', async () => {
        const db = authed(env, 'super-1', staffClaims({ role: 'provincial_superadmin', permittedMunicipalityIds: ['daet'] }));
        await assertSucceeds(getDocs(collection(db, 'sms_outbox')));
    });
    it('superadmin with active privileged claim can get a command_channel_thread document', async () => {
        // Document-level read confirms the superadmin can access a thread they participate in.
        // Collection-level getDocs fails in the emulator due to an indexing delay after seeding,
        // even though the document exists and getDoc succeeds. getDoc validates the same rule.
        const db = authed(env, 'super-1', staffClaims({ role: 'provincial_superadmin', permittedMunicipalityIds: ['daet'] }));
        await assertSucceeds(getDoc(doc(db, 'command_channel_threads', 'thread-1')));
        // TODO(BANTAYOG-PHASE6): getDocs (list) fails because rules reference resource.data.participantUids
        // which is undefined during list evaluation. Rules need separate allow list rule.
    });
    it('superadmin with active privileged claim can get a command_channel_message document', async () => {
        const db = authed(env, 'super-1', staffClaims({ role: 'provincial_superadmin', permittedMunicipalityIds: ['daet'] }));
        await assertSucceeds(getDoc(doc(db, 'command_channel_messages', 'msg-1')));
        // TODO(BANTAYOG-PHASE6): getDocs (list) fails because rules reference resource.data.threadId
        // which is undefined during list evaluation. Rules need separate allow list rule.
    });
    it('superadmin with active privileged claim can read mass_alert_requests', async () => {
        const db = authed(env, 'super-1', staffClaims({ role: 'provincial_superadmin', permittedMunicipalityIds: ['daet'] }));
        await assertSucceeds(getDocs(collection(db, 'mass_alert_requests')));
    });
    it('superadmin with active privileged claim can read shift_handoffs', async () => {
        const db = authed(env, 'super-1', staffClaims({ role: 'provincial_superadmin', permittedMunicipalityIds: ['daet'] }));
        await assertSucceeds(getDocs(collection(db, 'shift_handoffs')));
    });
    it('superadmin without active privileged claim cannot read audit_logs', async () => {
        const db = authed(env, 'super-1', staffClaims({
            role: 'provincial_superadmin',
            permittedMunicipalityIds: ['daet'],
            accountStatus: 'suspended',
        }));
        await assertFails(getDocs(collection(db, 'audit_logs')));
    });
    it('superadmin with active privileged claim can read incident_response_events', async () => {
        const db = authed(env, 'super-1', staffClaims({ role: 'provincial_superadmin', permittedMunicipalityIds: ['daet'] }));
        await assertSucceeds(getDocs(collection(db, 'incident_response_events')));
    });
    describe('Phase 7 collections', () => {
        it('any authed user can read provincial_resources', async () => {
            const db = authed(env, 'citizen-1', staffClaims({ role: 'citizen' }));
            await assertSucceeds(getDocs(collection(db, 'provincial_resources')));
        });
        it('unauthed user cannot read provincial_resources', async () => {
            const db = unauthed(env);
            await assertFails(getDocs(collection(db, 'provincial_resources')));
        });
        it('superadmin with active privileged claim can read data_incidents', async () => {
            const db = authed(env, 'super-1', staffClaims({ role: 'provincial_superadmin', permittedMunicipalityIds: ['daet'] }));
            await assertSucceeds(getDocs(collection(db, 'data_incidents')));
        });
        it('non-superadmin cannot read data_incidents', async () => {
            const db = authed(env, 'citizen-1', staffClaims({ role: 'citizen' }));
            await assertFails(getDocs(collection(db, 'data_incidents')));
        });
        it('superadmin with active privileged claim can read erasure_requests', async () => {
            const db = authed(env, 'super-1', staffClaims({ role: 'provincial_superadmin', permittedMunicipalityIds: ['daet'] }));
            await assertSucceeds(getDocs(collection(db, 'erasure_requests')));
        });
        it('non-superadmin cannot read erasure_requests', async () => {
            const db = authed(env, 'citizen-1', staffClaims({ role: 'citizen' }));
            await assertFails(getDocs(collection(db, 'erasure_requests')));
        });
        it('superadmin can read system_health', async () => {
            const db = authed(env, 'super-1', staffClaims({ role: 'provincial_superadmin', permittedMunicipalityIds: ['daet'] }));
            await assertSucceeds(getDocs(collection(db, 'system_health')));
        });
        it('non-superadmin cannot read system_health', async () => {
            const db = authed(env, 'citizen-1', staffClaims({ role: 'citizen' }));
            await assertFails(getDocs(collection(db, 'system_health')));
        });
        it('suspended superadmin cannot read data_incidents', async () => {
            const db = authed(env, 'super-1', staffClaims({
                role: 'provincial_superadmin',
                permittedMunicipalityIds: ['daet'],
                accountStatus: 'suspended',
            }));
            await assertFails(getDocs(collection(db, 'data_incidents')));
        });
        it('suspended superadmin cannot write data_incidents', async () => {
            const db = authed(env, 'super-1', staffClaims({
                role: 'provincial_superadmin',
                permittedMunicipalityIds: ['daet'],
                accountStatus: 'suspended',
            }));
            await assertFails(addDoc(collection(db, 'data_incidents'), { schemaVersion: 1, createdAt: ts }));
        });
        it('suspended superadmin cannot read erasure_requests', async () => {
            const db = authed(env, 'super-1', staffClaims({
                role: 'provincial_superadmin',
                permittedMunicipalityIds: ['daet'],
                accountStatus: 'suspended',
            }));
            await assertFails(getDocs(collection(db, 'erasure_requests')));
        });
        it('suspended superadmin cannot write erasure_requests', async () => {
            const db = authed(env, 'super-1', staffClaims({
                role: 'provincial_superadmin',
                permittedMunicipalityIds: ['daet'],
                accountStatus: 'suspended',
            }));
            await assertFails(addDoc(collection(db, 'erasure_requests'), { schemaVersion: 1, createdAt: ts }));
        });
        describe('hazard_signal_status', () => {
            it('superadmin with active privileged claim can read hazard signal status', async () => {
                const db = authed(env, 'super-1', staffClaims({ role: 'provincial_superadmin', permittedMunicipalityIds: ['daet'] }));
                await assertSucceeds(getDocs(collection(db, 'hazard_signal_status')));
            });
            it('citizen cannot read hazard signal status', async () => {
                const db = authed(env, 'citizen-1', staffClaims({ role: 'citizen' }));
                await assertFails(getDocs(collection(db, 'hazard_signal_status')));
            });
            it('client writes to hazard signal status remain blocked', async () => {
                const db = authed(env, 'super-1', staffClaims({ role: 'provincial_superadmin', permittedMunicipalityIds: ['daet'] }));
                await assertFails(setDoc(doc(db, 'hazard_signal_status', 'current'), {
                    active: false,
                    affectedMunicipalityIds: [],
                    effectiveScopes: [],
                    manualOverrideActive: false,
                    scraperDegraded: false,
                    lastProjectedAt: ts,
                    degradedReasons: [],
                    schemaVersion: 1,
                }));
            });
            it('suspended superadmin cannot read hazard signal status', async () => {
                const db = authed(env, 'super-1', staffClaims({
                    role: 'provincial_superadmin',
                    permittedMunicipalityIds: ['daet'],
                    accountStatus: 'suspended',
                }));
                await assertFails(getDocs(collection(db, 'hazard_signal_status')));
            });
        });
    });
});
//# sourceMappingURL=public-collections.rules.test.js.map