import { describe, expect, it } from 'vitest';
import { CAMARINES_NORTE_MUNICIPALITY_IDS } from './data.js';
describe('shared-data constants', () => {
    it('contains all 12 Camarines Norte municipalities', () => {
        expect(CAMARINES_NORTE_MUNICIPALITY_IDS).toHaveLength(12);
        const expected = new Set([
            'basud',
            'capalonga',
            'daet',
            'san_lorenzo_ruiz',
            'jose_panganiban',
            'labo',
            'mercedes',
            'paracale',
            'san_vicente',
            'santa_elena',
            'talisay',
            'vinzons',
        ]);
        const actual = new Set(CAMARINES_NORTE_MUNICIPALITY_IDS);
        expect(actual).toEqual(expected);
    });
    it('orders municipalities with basud first and vinzons last', () => {
        expect(CAMARINES_NORTE_MUNICIPALITY_IDS[0]).toBe('basud');
        expect(CAMARINES_NORTE_MUNICIPALITY_IDS[11]).toBe('vinzons');
    });
    it('type narrows to known municipality ids at compile time', () => {
        // Runtime assertion that the exported type can receive literal values
        const assertMunicipality = (id) => id;
        expect(assertMunicipality('daet')).toBe('daet');
        expect(assertMunicipality('labo')).toBe('labo');
        expect(assertMunicipality('vinzons')).toBe('vinzons');
    });
});
//# sourceMappingURL=data.test.js.map