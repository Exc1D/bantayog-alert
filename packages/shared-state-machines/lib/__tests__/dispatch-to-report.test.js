import { describe, expect, it } from 'vitest';
import { dispatchToReportState } from '../dispatch-to-report.js';
describe('dispatchToReportState', () => {
    const cases = [
        ['pending', null],
        ['accepted', 'acknowledged'],
        ['acknowledged', 'acknowledged'],
        ['en_route', 'en_route'],
        ['on_scene', 'on_scene'],
        ['resolved', 'resolved'],
        ['declined', null],
        ['timed_out', null],
        ['cancelled', null],
        ['superseded', null],
    ];
    it.each(cases)('maps %s → %s', (from, expected) => {
        expect(dispatchToReportState(from)).toBe(expected);
    });
});
//# sourceMappingURL=dispatch-to-report.test.js.map