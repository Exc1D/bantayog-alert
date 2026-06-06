import { describe, it, expect } from 'vitest';
import { commandChannelThreadDocSchema, commandChannelMessageDocSchema, agencyAssistanceRequestDocSchema, } from './coordination';
describe('Coordination Schemas', () => {
    it('does not publish canceled validator contracts from the package index', async () => {
        const validators = await import('./index.js');
        expect(validators).not.toHaveProperty('smsInboxDocSchema');
        expect(validators).not.toHaveProperty('smsOutboxDocSchema');
        expect(validators).not.toHaveProperty('detectEncoding');
        expect(validators).not.toHaveProperty('renderTemplate');
        expect(validators).not.toHaveProperty('renderBroadcastTemplate');
        expect(validators).not.toHaveProperty('SmsTemplateError');
        expect(validators).not.toHaveProperty('massAlertRequestDocSchema');
        expect(validators).not.toHaveProperty('breakglassEventDocSchema');
        expect(validators).not.toHaveProperty('reportSmsConsentDocSchema');
        expect(validators).not.toHaveProperty('ReportSmsConsentDoc');
        expect(validators).not.toHaveProperty('shiftHandoffDocSchema');
        expect(validators).not.toHaveProperty('fieldModeSessionDocSchema');
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
});
//# sourceMappingURL=coordination.test.js.map