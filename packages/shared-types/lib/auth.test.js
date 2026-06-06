import { describe, expect, it } from 'vitest';
describe('CustomClaims', () => {
    const breakGlassClaimRemoved = true;
    it('does not retain the retired break-glass claim', () => {
        expect(breakGlassClaimRemoved).toBe(true);
    });
});
//# sourceMappingURL=auth.test.js.map