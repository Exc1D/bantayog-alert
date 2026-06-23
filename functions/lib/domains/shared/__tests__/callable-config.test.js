import { describe, it, expect } from 'vitest';
import { getAdminCallableCorsOrigins, getCitizenCallableCorsOrigins, getResponderCallableCorsOrigins, } from '../callable-config.js';
describe('getAdminCallableCorsOrigins', () => {
    it('includes localhost dev origin when FUNCTIONS_EMULATOR=true', () => {
        const prev = process.env.FUNCTIONS_EMULATOR;
        process.env.FUNCTIONS_EMULATOR = 'true';
        const origins = getAdminCallableCorsOrigins();
        expect(origins).toContain('http://localhost:5175');
        expect(origins).toContain('https://bantayog-alert-staging.web.app');
        expect(origins).toContain('https://bantayogalert-staging.web.app');
        expect(origins).toContain('https://bantayog-alert.web.app');
        process.env.FUNCTIONS_EMULATOR = prev;
    });
    it('excludes localhost in production mode', () => {
        const prevEmulator = process.env.FUNCTIONS_EMULATOR;
        const prevNodeEnv = process.env.NODE_ENV;
        process.env.FUNCTIONS_EMULATOR = 'false';
        process.env.NODE_ENV = 'production';
        const origins = getAdminCallableCorsOrigins();
        expect(origins).not.toContain('http://localhost:5175');
        expect(origins).toContain('https://bantayog-alert-staging.web.app');
        expect(origins).toContain('https://bantayogalert-staging.web.app');
        expect(origins).toContain('https://bantayog-alert.web.app');
        expect(origins.length).toBe(3);
        process.env.FUNCTIONS_EMULATOR = prevEmulator;
        process.env.NODE_ENV = prevNodeEnv;
    });
    it('includes staging origin', () => {
        const origins = getAdminCallableCorsOrigins();
        expect(origins).toContain('https://bantayog-alert-staging.web.app');
        expect(origins).toContain('https://bantayogalert-staging.web.app');
    });
    it('includes production origin', () => {
        const origins = getAdminCallableCorsOrigins();
        expect(origins).toContain('https://bantayog-alert.web.app');
    });
});
describe('getCitizenCallableCorsOrigins', () => {
    it('includes localhost dev origin when FUNCTIONS_EMULATOR=true', () => {
        const prev = process.env.FUNCTIONS_EMULATOR;
        process.env.FUNCTIONS_EMULATOR = 'true';
        const origins = getCitizenCallableCorsOrigins();
        expect(origins).toContain('http://localhost:5173');
        process.env.FUNCTIONS_EMULATOR = prev;
    });
    it('excludes localhost in production mode', () => {
        const prevEmulator = process.env.FUNCTIONS_EMULATOR;
        const prevNodeEnv = process.env.NODE_ENV;
        process.env.FUNCTIONS_EMULATOR = 'false';
        process.env.NODE_ENV = 'production';
        const origins = getCitizenCallableCorsOrigins();
        expect(origins).not.toContain('http://localhost:5173');
        expect(origins).toContain('https://bantayogalert-citizen-stg.web.app');
        expect(origins).toContain('https://bantayog-citizen.web.app');
        process.env.FUNCTIONS_EMULATOR = prevEmulator;
        process.env.NODE_ENV = prevNodeEnv;
    });
});
describe('getResponderCallableCorsOrigins', () => {
    it('includes localhost dev origin when FUNCTIONS_EMULATOR=true', () => {
        const prev = process.env.FUNCTIONS_EMULATOR;
        process.env.FUNCTIONS_EMULATOR = 'true';
        const origins = getResponderCallableCorsOrigins();
        expect(origins).toContain('http://localhost:5174');
        process.env.FUNCTIONS_EMULATOR = prev;
    });
    it('excludes localhost in production mode', () => {
        const prevEmulator = process.env.FUNCTIONS_EMULATOR;
        const prevNodeEnv = process.env.NODE_ENV;
        process.env.FUNCTIONS_EMULATOR = 'false';
        process.env.NODE_ENV = 'production';
        const origins = getResponderCallableCorsOrigins();
        expect(origins).not.toContain('http://localhost:5174');
        expect(origins).toContain('https://bantayogalert-responder-stg.web.app');
        process.env.FUNCTIONS_EMULATOR = prevEmulator;
        process.env.NODE_ENV = prevNodeEnv;
    });
});
//# sourceMappingURL=callable-config.test.js.map