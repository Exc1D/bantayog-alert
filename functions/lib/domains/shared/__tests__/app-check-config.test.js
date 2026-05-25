import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { shouldEnforceAppCheck } from '../app-check-config.js';
describe('shouldEnforceAppCheck', () => {
    const originalEnv = process.env;
    beforeEach(() => {
        process.env = { ...originalEnv };
    });
    afterEach(() => {
        process.env = originalEnv;
    });
    it('returns true for staging project', () => {
        process.env.GCLOUD_PROJECT = 'bantayog-alert-staging';
        expect(shouldEnforceAppCheck()).toBe(true);
    });
    it('returns false for local emulator runs', () => {
        process.env.GCLOUD_PROJECT = 'bantayog-alert-staging';
        process.env.FUNCTIONS_EMULATOR = 'true';
        expect(shouldEnforceAppCheck()).toBe(false);
    });
    it('returns true for local emulator runs when explicitly enforced', () => {
        process.env.GCLOUD_PROJECT = 'bantayog-alert-staging';
        process.env.FUNCTIONS_EMULATOR = 'true';
        process.env.ENFORCE_APP_CHECK = 'true';
        expect(shouldEnforceAppCheck()).toBe(true);
    });
    it('returns true for production project', () => {
        process.env.GCLOUD_PROJECT = 'bantayog-alert';
        expect(shouldEnforceAppCheck()).toBe(true);
    });
    it('returns true when GCLOUD_PROJECT is undefined', () => {
        delete process.env.GCLOUD_PROJECT;
        expect(shouldEnforceAppCheck()).toBe(true);
    });
    it('returns true for unrelated project ids', () => {
        process.env.GCLOUD_PROJECT = 'some-other-project';
        expect(shouldEnforceAppCheck()).toBe(true);
    });
});
//# sourceMappingURL=app-check-config.test.js.map