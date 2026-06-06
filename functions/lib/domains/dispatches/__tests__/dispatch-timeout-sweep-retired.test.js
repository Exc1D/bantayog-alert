import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
describe('dispatch timeout sweep retirement', () => {
    it('dispatchTimeoutSweep is no longer exported from functions index', () => {
        const indexPath = resolve(import.meta.dirname, '../../../../src/index.ts');
        const content = readFileSync(indexPath, 'utf-8');
        expect(content).not.toContain('export { dispatchTimeoutSweep }');
    });
    it('dispatch timeout sweep source is removed to prevent accidental re-export', () => {
        const sourcePath = resolve(import.meta.dirname, '../dispatch-timeout-sweep.ts');
        expect(() => readFileSync(sourcePath, 'utf-8')).toThrow();
    });
    it('retired function exports are absent from functions index', () => {
        const indexPath = resolve(import.meta.dirname, '../../../../src/index.ts');
        const content = readFileSync(indexPath, 'utf-8');
        const retiredExports = [
            'addCommandChannelMessage',
            'enterFieldMode',
            'exitFieldMode',
            'initiateShiftHandoff',
            'acceptShiftHandoff',
            'declareDataIncident',
            'recordIncidentResponseEvent',
            'upsertProvincialResource',
            'archiveProvincialResource',
        ];
        for (const name of retiredExports) {
            expect(content).not.toContain(name);
        }
    });
});
//# sourceMappingURL=dispatch-timeout-sweep-retired.test.js.map