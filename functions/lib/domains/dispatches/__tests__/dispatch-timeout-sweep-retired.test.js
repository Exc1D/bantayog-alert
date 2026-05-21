import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
describe('dispatch timeout sweep retirement', () => {
    it('dispatchTimeoutSweep is no longer exported from functions index', () => {
        const indexPath = resolve(import.meta.dirname, '../../../../src/index.ts');
        const content = readFileSync(indexPath, 'utf-8');
        expect(content).not.toContain('export { dispatchTimeoutSweep }');
    });
});
//# sourceMappingURL=dispatch-timeout-sweep-retired.test.js.map