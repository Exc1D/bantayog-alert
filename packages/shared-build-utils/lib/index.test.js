import { describe, expect, it } from 'vitest';
import { assertNoEmulatorInProduction } from './index.js';
describe('assertNoEmulatorInProduction', () => {
    it('throws when building production with emulator=true', () => {
        expect(() => assertNoEmulatorInProduction('build', 'production', 'true', 'test-app')).toThrow('Refusing production test-app build with VITE_USE_EMULATOR=true');
    });
    it('throws when building production with emulator=1', () => {
        expect(() => assertNoEmulatorInProduction('build', 'production', '1', 'test-app')).toThrow('Refusing production test-app build with VITE_USE_EMULATOR=1');
    });
    it('is case-insensitive for TRUE', () => {
        expect(() => assertNoEmulatorInProduction('build', 'production', 'TRUE', 'test-app')).toThrow('Refusing production test-app build with VITE_USE_EMULATOR=TRUE');
    });
    it('does not throw when emulator is false', () => {
        expect(() => assertNoEmulatorInProduction('build', 'production', 'false', 'test-app')).not.toThrow();
    });
    it('does not throw when emulator is undefined', () => {
        expect(() => assertNoEmulatorInProduction('build', 'production', undefined, 'test-app')).not.toThrow();
    });
    it('does not throw in dev mode even with emulator=true', () => {
        expect(() => assertNoEmulatorInProduction('serve', 'development', 'true', 'test-app')).not.toThrow();
    });
    it('does not throw during preview', () => {
        expect(() => assertNoEmulatorInProduction('build', 'staging', 'true', 'test-app')).not.toThrow();
    });
});
//# sourceMappingURL=index.test.js.map