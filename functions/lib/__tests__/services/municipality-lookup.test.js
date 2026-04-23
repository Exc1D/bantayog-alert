import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMunicipalityLookup } from '../../services/municipality-lookup.js';
const mockGet = vi.fn();
function db() {
    return {
        collection: () => ({ get: mockGet }),
    };
}
beforeEach(() => mockGet.mockReset());
describe('municipality lookup', () => {
    it('loads the map once and caches it', async () => {
        mockGet.mockResolvedValue({
            docs: [
                { id: 'daet', data: () => ({ label: 'Daet' }) },
                { id: 'basud', data: () => ({ label: 'Basud' }) },
            ],
        });
        const lookup = createMunicipalityLookup(db());
        expect(await lookup.label('daet')).toBe('Daet');
        expect(await lookup.label('basud')).toBe('Basud');
        expect(mockGet).toHaveBeenCalledTimes(1);
    });
    it('throws on unknown id', async () => {
        mockGet.mockResolvedValue({ docs: [{ id: 'daet', data: () => ({ label: 'Daet' }) }] });
        const lookup = createMunicipalityLookup(db());
        await expect(lookup.label('unknown')).rejects.toMatchObject({ code: 'FORBIDDEN' });
    });
});
//# sourceMappingURL=municipality-lookup.test.js.map