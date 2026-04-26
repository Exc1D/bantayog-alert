import { describe, it, expect, vi, beforeEach } from 'vitest';
const { mockSendEachForMulticast, mockCollection, mockDoc, mockGet, mockUpdate, mockRunTransaction, } = vi.hoisted(() => {
    return {
        mockSendEachForMulticast: vi.fn(),
        mockCollection: vi.fn(),
        mockDoc: vi.fn(),
        mockGet: vi.fn(),
        mockUpdate: vi.fn(),
        mockRunTransaction: vi.fn(),
    };
});
vi.mock('firebase-admin/messaging', () => ({
    getMessaging: vi.fn(() => ({
        sendEachForMulticast: mockSendEachForMulticast,
    })),
}));
vi.mock('../../admin-init.js', () => ({
    adminDb: {
        collection: mockCollection.mockReturnValue({
            doc: mockDoc.mockReturnValue({
                get: mockGet,
                update: mockUpdate,
            }),
        }),
        runTransaction: mockRunTransaction,
    },
}));
import { sendFcmToResponder } from '../../services/fcm-send.js';
import { FieldValue } from 'firebase-admin/firestore';
function setupTransactionMock(currentTokens) {
    const txUpdate = vi.fn();
    mockRunTransaction.mockImplementation(async (fn) => {
        const tx = {
            get: vi.fn().mockResolvedValue({
                exists: true,
                data: () => ({ fcmTokens: currentTokens }),
            }),
            update: txUpdate,
        };
        await fn(tx);
        return undefined;
    });
    return { txUpdate };
}
describe('sendFcmToResponder', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });
    it('returns warning when responder document does not exist', async () => {
        mockGet.mockResolvedValueOnce({ exists: false });
        const result = await sendFcmToResponder({ uid: 'r1', title: 'T', body: 'B' });
        expect(result.warnings).toEqual(['fcm_no_token']);
    });
    it('returns warning when responder has no tokens', async () => {
        mockGet.mockResolvedValueOnce({ exists: true, data: () => ({ fcmTokens: [] }) });
        const result = await sendFcmToResponder({ uid: 'r1', title: 'T', body: 'B' });
        expect(result.warnings).toEqual(['fcm_no_token']);
    });
    it('sends multicast and returns empty warnings on success', async () => {
        mockGet.mockResolvedValueOnce({ exists: true, data: () => ({ fcmTokens: ['token1'] }) });
        mockSendEachForMulticast.mockResolvedValueOnce({
            responses: [{ success: true }],
        });
        const result = await sendFcmToResponder({ uid: 'r1', title: 'T', body: 'B' });
        expect(result.warnings).toEqual([]);
        expect(mockSendEachForMulticast).toHaveBeenCalledWith({
            tokens: ['token1'],
            notification: { title: 'T', body: 'B' },
        });
    });
    it('removes invalid tokens on failure', async () => {
        mockGet.mockResolvedValueOnce({
            exists: true,
            data: () => ({ fcmTokens: ['valid', 'invalid'] }),
        });
        mockSendEachForMulticast.mockResolvedValueOnce({
            responses: [
                { success: true },
                { success: false, error: { code: 'messaging/invalid-registration-token' } },
            ],
        });
        const arrayRemoveSpy = vi
            .spyOn(FieldValue, 'arrayRemove')
            .mockReturnValue('array_remove_mock'); // eslint-disable-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument
        const { txUpdate } = setupTransactionMock(['valid', 'invalid']);
        const result = await sendFcmToResponder({ uid: 'r1', title: 'T', body: 'B' });
        expect(result.warnings).toEqual(['fcm_one_token_invalid']);
        expect(txUpdate).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
            fcmTokens: 'array_remove_mock',
            hasFcmToken: true,
        }));
        expect(arrayRemoveSpy).toHaveBeenCalledWith('invalid');
    });
    it('clears hasFcmToken when all tokens are invalid', async () => {
        mockGet.mockResolvedValueOnce({
            exists: true,
            data: () => ({ fcmTokens: ['invalid1', 'invalid2'] }),
        });
        mockSendEachForMulticast.mockResolvedValueOnce({
            responses: [
                { success: false, error: { code: 'messaging/invalid-registration-token' } },
                { success: false, error: { code: 'messaging/registration-token-not-registered' } },
            ],
        });
        const arrayRemoveSpy = vi
            .spyOn(FieldValue, 'arrayRemove')
            .mockReturnValue('array_remove_mock'); // eslint-disable-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument
        const { txUpdate } = setupTransactionMock(['invalid1', 'invalid2']);
        const result = await sendFcmToResponder({ uid: 'r1', title: 'T', body: 'B' });
        expect(result.warnings).toEqual(['fcm_one_token_invalid']);
        expect(txUpdate).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
            fcmTokens: 'array_remove_mock',
            hasFcmToken: false,
        }));
        expect(arrayRemoveSpy).toHaveBeenCalledWith('invalid1', 'invalid2');
    });
    it('retries once on transport failure', async () => {
        mockGet.mockResolvedValueOnce({ exists: true, data: () => ({ fcmTokens: ['token1'] }) });
        mockSendEachForMulticast
            .mockRejectedValueOnce(new Error('Network Error'))
            .mockResolvedValueOnce({
            responses: [{ success: true }],
        });
        const result = await sendFcmToResponder({ uid: 'r1', title: 'T', body: 'B' });
        expect(result.warnings).toEqual([]);
        expect(mockSendEachForMulticast).toHaveBeenCalledTimes(2);
    });
    it('returns network error warning on retry failure', async () => {
        mockGet.mockResolvedValueOnce({ exists: true, data: () => ({ fcmTokens: ['token1'] }) });
        mockSendEachForMulticast
            .mockRejectedValueOnce(new Error('Network Error'))
            .mockRejectedValueOnce(new Error('Network Error 2'));
        const result = await sendFcmToResponder({ uid: 'r1', title: 'T', body: 'B' });
        expect(result.warnings).toEqual(['fcm_network_error']);
        expect(mockSendEachForMulticast).toHaveBeenCalledTimes(2);
    });
});
//# sourceMappingURL=fcm-send.test.js.map