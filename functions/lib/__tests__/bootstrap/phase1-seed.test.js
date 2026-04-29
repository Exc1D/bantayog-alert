import { describe, it, expect } from 'vitest';
import { buildPhase1SeedDocs } from '../../bootstrap/phase1-seed.js';
describe('buildPhase1SeedDocs', () => {
    it('sets citizen/admin/responder versions to 1.0.0', () => {
        const seed = buildPhase1SeedDocs(1000);
        expect(seed.systemConfig.min_app_version.citizen).toBe('1.0.0');
        expect(seed.systemConfig.min_app_version.admin).toBe('1.0.0');
        expect(seed.systemConfig.min_app_version.responder).toBe('1.0.0');
    });
    it('includes update_urls with citizen/admin/responder keys', () => {
        const seed = buildPhase1SeedDocs(1000);
        expect(seed.systemConfig.update_urls.citizen).toContain('bantayog');
        expect(seed.systemConfig.update_urls.admin).toContain('bantayog');
        expect(seed.systemConfig.update_urls.responder).toBeTruthy();
    });
});
//# sourceMappingURL=phase1-seed.test.js.map