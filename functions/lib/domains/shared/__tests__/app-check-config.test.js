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
    it('returns false for staging project', () => {
        process.env.GCLOUD_PROJECT = 'bantayog-alert-staging';
        expect(shouldEnforceAppCheck()).toBe(false);
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