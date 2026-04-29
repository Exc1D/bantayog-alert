import { describe, it, expect, vi } from 'vitest';
import { semverLt } from './config.js';
describe('semverLt', () => {
    it('returns true when a is older than b', () => {
        expect(semverLt('0.9.0', '1.0.0')).toBe(true);
        expect(semverLt('1.0.0', '1.0.1')).toBe(true);
        expect(semverLt('0.0.0', '99.0.0')).toBe(true);
    });
    it('returns false when a equals b', () => {
        expect(semverLt('1.0.0', '1.0.0')).toBe(false);
    });
    it('returns false when a is newer than b', () => {
        expect(semverLt('2.0.0', '1.0.0')).toBe(false);
        expect(semverLt('1.1.0', '1.0.0')).toBe(false);
    });
    it('returns true and warns on invalid input (fail-safe)', () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => { });
        expect(semverLt('1.0.0-beta', '1.0.0')).toBe(true);
        expect(warnSpy).toHaveBeenCalledWith('[semverLt] Invalid semver input: "1.0.0-beta" vs "1.0.0"');
        warnSpy.mockRestore();
    });
    it('returns true and warns on empty input', () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => { });
        expect(semverLt('', '1.0.0')).toBe(true);
        expect(warnSpy).toHaveBeenCalledWith('[semverLt] Invalid semver input: "" vs "1.0.0"');
        warnSpy.mockRestore();
    });
    it('returns true and warns on malformed input', () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => { });
        expect(semverLt('1.0', '1.0.0')).toBe(true);
        expect(semverLt('1.0.0.1', '1.0.0')).toBe(true);
        warnSpy.mockRestore();
    });
});
//# sourceMappingURL=config.test.js.map