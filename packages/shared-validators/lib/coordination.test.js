import { describe, it, expect } from 'vitest';
import { shiftHandoffDocSchema, massAlertRequestDocSchema, commandChannelThreadDocSchema, commandChannelMessageDocSchema, agencyAssistanceRequestDocSchema, fieldModeSessionDocSchema, responderShiftHandoffDocSchema, } from './coordination';
describe('Coordination Schemas', () => {
    describe('shiftHandoffDocSchema', () => {
        it('accepts valid shift handoff document', () => {
            const validDoc = {
                fromUid: 'responder-1',
                toUid: 'responder-2',
                municipalityId: 'daet',
                activeIncidentSnapshot: ['incident-1', 'incident-2'],
                notes: 'Shift change normal',
                status: 'pending',
                createdAt: 1713350400000,
                acceptedAt: 1713350401000,
                expiresAt: 1713436800000,
                schemaVersion: 1,
            };
            expect(() => shiftHandoffDocSchema.parse(validDoc)).not.toThrow();
        });
        it('accepts a handoff without toUid', () => {
            const validDoc = {
                fromUid: 'responder-1',
                municipalityId: 'daet',
                activeIncidentSnapshot: ['incident-1', 'incident-2'],
                notes: 'Shift change normal',
                status: 'pending',
                createdAt: 1713350400000,
                escalatedAt: 1713350405000,
                expiresAt: 1713436800000,
                schemaVersion: 1,
            };
            expect(() => shiftHandoffDocSchema.parse(validDoc)).not.toThrow();
        });
        it('rejects invalid status literal', () => {
            const invalidDoc = {
                fromUid: 'responder-1',
                toUid: 'responder-2',
                municipalityId: 'daet',
                activeIncidentSnapshot: [],
                notes: 'Test',
                status: 'invalid-status',
                createdAt: 1713350400000,
                expiresAt: 1713436800000,
                schemaVersion: 1,
            };
            expect(() => shiftHandoffDocSchema.parse(invalidDoc)).toThrow();
        });
        it('rejects unknown keys via strict mode', () => {
            const docWithExtraKey = {
                fromUid: 'responder-1',
                toUid: 'responder-2',
                municipalityId: 'daet',
                activeIncidentSnapshot: [],
                notes: 'Test',
                status: 'pending',
                createdAt: 1713350400000,
                expiresAt: 1713436800000,
                schemaVersion: 1,
                unknownField: 'should not be allowed',
            };
            expect(() => shiftHandoffDocSchema.parse(docWithExtraKey)).toThrow();
        });
    });
    describe('massAlertRequestDocSchema', () => {
        it('accepts valid mass alert request document', () => {
            const validDoc = {
                requestedByMunicipality: 'Daet',
                requestedByUid: 'admin-1',
                severity: 'high',
                body: 'Evacuation alert for Barangay X',
                targetType: 'municipality',
                estimatedReach: 5000,
                status: 'queued',
                createdAt: 1713350400000,
                forwardedAt: 1713350401000,
                forwardMethod: 'sms',
                ndrrmcRecipient: 'NDRRMC-ops',
                sentAt: 1713350402000,
                schemaVersion: 1,
            };
            expect(() => massAlertRequestDocSchema.parse(validDoc)).not.toThrow();
        });
        it('rejects invalid severity literal', () => {
            const invalidDoc = {
                requestedByMunicipality: 'Daet',
                requestedByUid: 'admin-1',
                severity: 'invalid-severity',
                body: 'Test',
                targetType: 'municipality',
                estimatedReach: 100,
                status: 'queued',
                createdAt: 1713350400000,
                schemaVersion: 1,
            };
            expect(() => massAlertRequestDocSchema.parse(invalidDoc)).toThrow();
        });
        it('rejects unknown keys via strict mode', () => {
            const docWithExtraKey = {
                requestedByMunicipality: 'Daet',
                requestedByUid: 'admin-1',
                severity: 'high',
                body: 'Test',
                targetType: 'municipality',
                estimatedReach: 100,
                status: 'queued',
                createdAt: 1713350400000,
                schemaVersion: 1,
                unknownField: 'should not be allowed',
            };
            expect(() => massAlertRequestDocSchema.parse(docWithExtraKey)).toThrow();
        });
        it('accepts the expanded review statuses', () => {
            for (const status of ['sent', 'pending_ndrrmc_review', 'declined']) {
                const validDoc = {
                    requestedByMunicipality: 'Daet',
                    requestedByUid: 'admin-1',
                    severity: 'high',
                    body: 'Evacuation alert for Barangay X',
                    targetType: 'municipality',
                    estimatedReach: 5000,
                    status,
                    createdAt: 1713350400000,
                    schemaVersion: 1,
                };
                expect(() => massAlertRequestDocSchema.parse(validDoc)).not.toThrow();
            }
        });
    });
    describe('commandChannelThreadDocSchema', () => {
        it('accepts valid command channel thread document', () => {
            const validDoc = {
                threadId: 'thread-123',
                reportId: 'report-123',
                threadType: 'agency_assistance',
                assistanceRequestId: 'request-123',
                subject: 'Emergency response coordination',
                participantUids: { 'admin-1': true, 'responder-1': true },
                createdBy: 'admin-1',
                createdAt: 1713350400000,
                updatedAt: 1713350401000,
                schemaVersion: 1,
            };
            expect(() => commandChannelThreadDocSchema.parse(validDoc)).not.toThrow();
        });
        it('rejects missing required fields', () => {
            const incompleteDoc = {
                threadId: 'thread-123',
                // missing subject, participantUids, createdBy
                createdAt: 1713350400000,
                updatedAt: 1713350401000,
                schemaVersion: 1,
            };
            expect(() => commandChannelThreadDocSchema.parse(incompleteDoc)).toThrow();
        });
        it('rejects a thread without reportId', () => {
            const incompleteDoc = {
                threadId: 'thread-123',
                threadType: 'agency_assistance',
                subject: 'Emergency response coordination',
                participantUids: { 'admin-1': true },
                createdBy: 'admin-1',
                createdAt: 1713350400000,
                updatedAt: 1713350401000,
                schemaVersion: 1,
            };
            expect(() => commandChannelThreadDocSchema.parse(incompleteDoc)).toThrow();
        });
        it('rejects unknown keys via strict mode', () => {
            const docWithExtraKey = {
                threadId: 'thread-123',
                subject: 'Test',
                participantUids: {},
                createdBy: 'admin-1',
                createdAt: 1713350400000,
                updatedAt: 1713350401000,
                schemaVersion: 1,
                unknownField: 'should not be allowed',
            };
            expect(() => commandChannelThreadDocSchema.parse(docWithExtraKey)).toThrow();
        });
    });
    describe('commandChannelMessageDocSchema', () => {
        it('accepts valid command channel message document', () => {
            const validDoc = {
                threadId: 'thread-123',
                authorUid: 'admin-1',
                authorRole: 'municipal_admin',
                body: 'Proceed to location immediately',
                idempotencyKey: '11111111-1111-4111-8111-111111111111',
                createdAt: 1713350400000,
                schemaVersion: 1,
            };
            expect(() => commandChannelMessageDocSchema.parse(validDoc)).not.toThrow();
        });
        it('rejects invalid authorRole literal', () => {
            const invalidDoc = {
                threadId: 'thread-123',
                authorUid: 'admin-1',
                authorRole: 'invalid-role',
                body: 'Test',
                createdAt: 1713350400000,
                schemaVersion: 1,
            };
            expect(() => commandChannelMessageDocSchema.parse(invalidDoc)).toThrow();
        });
        it('rejects body longer than 2000 characters', () => {
            const invalidDoc = {
                threadId: 'thread-123',
                authorUid: 'admin-1',
                authorRole: 'municipal_admin',
                body: 'a'.repeat(2001), // exceeds max(2000)
                createdAt: 1713350400000,
                schemaVersion: 1,
            };
            expect(() => commandChannelMessageDocSchema.parse(invalidDoc)).toThrow();
        });
        it('rejects unknown keys via strict mode', () => {
            const docWithExtraKey = {
                threadId: 'thread-123',
                authorUid: 'admin-1',
                authorRole: 'municipal_admin',
                body: 'Test',
                createdAt: 1713350400000,
                schemaVersion: 1,
                unknownField: 'should not be allowed',
            };
            expect(() => commandChannelMessageDocSchema.parse(docWithExtraKey)).toThrow();
        });
    });
    describe('agencyAssistanceRequestDocSchema', () => {
        it('accepts valid agency assistance request document', () => {
            const validDoc = {
                reportId: 'report-123',
                requestedByMunicipalId: 'daet',
                requestedByMunicipality: 'Daet',
                targetAgencyId: 'bfp',
                requestType: 'BFP',
                message: 'Requesting assistance for flood response',
                priority: 'urgent',
                status: 'pending',
                fulfilledByDispatchIds: [],
                createdAt: 1713350400000,
                expiresAt: 1713436800000,
                schemaVersion: 1,
            };
            expect(() => agencyAssistanceRequestDocSchema.parse(validDoc)).not.toThrow();
        });
        it('rejects when expiresAt is not after createdAt', () => {
            const invalidDoc = {
                reportId: 'report-123',
                requestedByMunicipalId: 'daet',
                requestedByMunicipality: 'Daet',
                targetAgencyId: 'bfp',
                requestType: 'BFP',
                message: 'Test',
                priority: 'normal',
                status: 'pending',
                fulfilledByDispatchIds: [],
                createdAt: 1713350400000,
                expiresAt: 1713350399999, // before createdAt
            };
            expect(() => agencyAssistanceRequestDocSchema.parse(invalidDoc)).toThrow();
        });
        it('rejects unknown keys via strict mode', () => {
            const docWithExtraKey = {
                reportId: 'report-123',
                requestedByMunicipalId: 'daet',
                requestedByMunicipality: 'Daet',
                targetAgencyId: 'bfp',
                requestType: 'BFP',
                message: 'Test',
                priority: 'normal',
                status: 'pending',
                fulfilledByDispatchIds: [],
                createdAt: 1713350400000,
                expiresAt: 1713436800000,
                unknownField: 'should not be allowed',
            };
            expect(() => agencyAssistanceRequestDocSchema.parse(docWithExtraKey)).toThrow();
        });
        it('accepts respondedBy and escalatedAt fields', () => {
            const validDoc = {
                reportId: 'report-123',
                requestedByMunicipalId: 'daet',
                requestedByMunicipality: 'Daet',
                targetAgencyId: 'bfp',
                requestType: 'BFP',
                message: 'Requesting assistance for flood response',
                priority: 'urgent',
                status: 'accepted',
                declinedReason: undefined,
                fulfilledByDispatchIds: [],
                createdAt: 1713350400000,
                respondedAt: 1713350401000,
                respondedBy: 'admin-1',
                escalatedAt: 1713350402000,
                expiresAt: 1713436800000,
                schemaVersion: 1,
            };
            expect(() => agencyAssistanceRequestDocSchema.parse(validDoc)).not.toThrow();
        });
    });
    describe('fieldModeSessionDocSchema', () => {
        it('accepts valid field mode session document', () => {
            const validDoc = {
                uid: 'admin-1',
                municipalityId: 'daet',
                enteredAt: 1713350400000,
                expiresAt: 1713393600000,
                isActive: true,
                schemaVersion: 1,
            };
            expect(() => fieldModeSessionDocSchema.parse(validDoc)).not.toThrow();
        });
        it('rejects when expiresAt is not after enteredAt', () => {
            const invalidDoc = {
                uid: 'admin-1',
                municipalityId: 'daet',
                enteredAt: 1713350400000,
                expiresAt: 1713350399999,
                isActive: true,
                schemaVersion: 1,
            };
            expect(() => fieldModeSessionDocSchema.parse(invalidDoc)).toThrow();
        });
    });
    describe('responderShiftHandoffDocSchema', () => {
        it('accepts valid responder shift handoff document', () => {
            const validDoc = {
                fromUid: 'responder-a',
                toUid: 'responder-b',
                agencyId: 'bfp-daet',
                municipalityId: 'daet',
                reason: 'End of shift',
                status: 'pending',
                createdAt: 1713350400000,
                expiresAt: 1713354000000,
                schemaVersion: 1,
            };
            expect(() => responderShiftHandoffDocSchema.parse(validDoc)).not.toThrow();
        });
        it('rejects invalid status literal', () => {
            const invalidDoc = {
                fromUid: 'responder-a',
                toUid: 'responder-b',
                agencyId: 'bfp-daet',
                municipalityId: 'daet',
                reason: 'End of shift',
                status: 'expired',
                createdAt: 1713350400000,
                expiresAt: 1713354000000,
                schemaVersion: 1,
            };
            expect(() => responderShiftHandoffDocSchema.parse(invalidDoc)).toThrow();
        });
        it('rejects when expiresAt is not after createdAt', () => {
            const invalidDoc = {
                fromUid: 'responder-a',
                toUid: 'responder-b',
                agencyId: 'bfp-daet',
                municipalityId: 'daet',
                reason: 'End of shift',
                status: 'pending',
                createdAt: 1713350400000,
                expiresAt: 1713350399999,
                schemaVersion: 1,
            };
            expect(() => responderShiftHandoffDocSchema.parse(invalidDoc)).toThrow();
        });
        it('rejects unknown keys via strict mode', () => {
            const docWithExtraKey = {
                fromUid: 'responder-a',
                toUid: 'responder-b',
                agencyId: 'bfp-daet',
                municipalityId: 'daet',
                reason: 'End of shift',
                status: 'pending',
                createdAt: 1713350400000,
                expiresAt: 1713354000000,
                schemaVersion: 1,
                unknownField: 'should not be allowed',
            };
            expect(() => responderShiftHandoffDocSchema.parse(docWithExtraKey)).toThrow();
        });
    });
});
//# sourceMappingURL=coordination.test.js.map