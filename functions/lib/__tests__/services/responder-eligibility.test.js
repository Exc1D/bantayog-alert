import { describe, it, expect, beforeEach } from 'vitest';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { getEligibleResponders } from '../../services/responder-eligibility.js';
import { seedResponderDoc, seedResponderShift } from '../helpers/seed-factories.js';
let testEnv;
beforeEach(async () => {
    testEnv = await initializeTestEnvironment({
        projectId: 'eligibility-test',
        firestore: { host: 'localhost', port: 8080 },
        database: { host: 'localhost', port: 9000 },
    });
    await testEnv.clearFirestore();
    await testEnv.clearDatabase();
});
describe('getEligibleResponders', () => {
    it('returns only active responders in the target municipality who are on shift', async () => {
        await testEnv.withSecurityRulesDisabled(async (ctx) => {
            const db = ctx.firestore();
            const rtdb = ctx.database();
            await seedResponderDoc(db, {
                uid: 'r1',
                municipalityId: 'daet',
                agencyId: 'bfp-daet',
                isActive: true,
            });
            await seedResponderDoc(db, {
                uid: 'r2',
                municipalityId: 'daet',
                agencyId: 'bfp-daet',
                isActive: true,
            });
            await seedResponderDoc(db, {
                uid: 'r3',
                municipalityId: 'daet',
                agencyId: 'bfp-daet',
                isActive: false,
            });
            await seedResponderDoc(db, {
                uid: 'r4',
                municipalityId: 'mercedes',
                agencyId: 'bfp-mercedes',
                isActive: true,
            });
            await seedResponderShift(rtdb, 'daet', 'r1', true);
            await seedResponderShift(rtdb, 'daet', 'r2', false);
            await seedResponderShift(rtdb, 'mercedes', 'r4', true);
            const result = await getEligibleResponders(db, rtdb, { municipalityId: 'daet' });
            expect(result.map((r) => r.uid).sort()).toEqual(['r1']);
        });
    });
    it('filters by agency when provided', async () => {
        await testEnv.withSecurityRulesDisabled(async (ctx) => {
            const db = ctx.firestore();
            const rtdb = ctx.database();
            await seedResponderDoc(db, {
                uid: 'bfp1',
                municipalityId: 'daet',
                agencyId: 'bfp-daet',
                isActive: true,
            });
            await seedResponderDoc(db, {
                uid: 'mdrrmo1',
                municipalityId: 'daet',
                agencyId: 'mdrrmo-daet',
                isActive: true,
            });
            await seedResponderShift(rtdb, 'daet', 'bfp1', true);
            await seedResponderShift(rtdb, 'daet', 'mdrrmo1', true);
            const result = await getEligibleResponders(db, rtdb, {
                municipalityId: 'daet',
                agencyId: 'bfp-daet',
            });
            expect(result.map((r) => r.uid)).toEqual(['bfp1']);
        });
    });
});
//# sourceMappingURL=responder-eligibility.test.js.map