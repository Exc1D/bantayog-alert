import { describe, it, expect } from 'vitest';
import { REPORT_STATES, REPORT_TRANSITIONS, DISPATCH_STATES, DISPATCH_TRANSITIONS, isValidReportTransition, isValidDispatchTransition, } from './state-machines/index.js';
// Report state machine: exhaustive matrix — every declared transition valid, all
// others invalid. This is the codegen source-of-truth for both TypeScript and
// Firestore rules transition tables.
describe('report state machine', () => {
    it('REPORT_STATES has 15 members (spec §5.3)', () => {
        expect(REPORT_STATES).toHaveLength(15);
    });
    it('REPORT_TRANSITIONS has 22 declared transitions (spec §5.3)', () => {
        expect(REPORT_TRANSITIONS).toHaveLength(22);
    });
    it('every declared transition is valid', () => {
        for (const [from, to] of REPORT_TRANSITIONS) {
            expect(isValidReportTransition(from, to), `${from} → ${to} should be valid`).toBe(true);
        }
    });
    it('all undeclared transitions are invalid (exhaustive matrix)', () => {
        let invalidCount = 0;
        for (const from of REPORT_STATES) {
            for (const to of REPORT_STATES) {
                if (from === to) {
                    // Self-transitions are not declared — confirm they fail
                    expect(isValidReportTransition(from, to), `${from}→${to} self-transition`).toBe(false);
                    invalidCount++;
                }
                else {
                    const declared = REPORT_TRANSITIONS.some(([f, t]) => f === from && t === to);
                    if (!declared) {
                        expect(isValidReportTransition(from, to), `${from}→${to} should be invalid`).toBe(false);
                        invalidCount++;
                    }
                }
            }
        }
        // 15 states × 15 states = 225 total; 22 declared valid means 203 invalid
        expect(invalidCount).toBe(203);
    });
});
// Dispatch state machine: only responder-direct transitions live in the rules
// layer (spec §5.4). Server-authoritative transitions are enforced in callables.
describe('dispatch state machine', () => {
    it('DISPATCH_STATES has 11 members (Phase 6: unable_to_complete)', () => {
        expect(DISPATCH_STATES).toHaveLength(11);
    });
    it('DISPATCH_TRANSITIONS declares 21 transitions', () => {
        // Count entries across all states
        const total = DISPATCH_STATES.reduce((sum, state) => sum + DISPATCH_TRANSITIONS[state].length, 0);
        expect(total).toBe(21);
    });
    it('every declared responder-direct transition is valid', () => {
        for (const from of DISPATCH_STATES) {
            for (const to of DISPATCH_TRANSITIONS[from]) {
                expect(isValidDispatchTransition(from, to), `${from} → ${to} should be valid`).toBe(true);
            }
        }
    });
    it('all undeclared responder transitions are invalid', () => {
        for (const from of DISPATCH_STATES) {
            for (const to of DISPATCH_STATES) {
                if (from === to) {
                    expect(isValidDispatchTransition(from, to)).toBe(false);
                    continue;
                }
                const allowed = DISPATCH_TRANSITIONS[from].includes(to);
                if (!allowed) {
                    expect(isValidDispatchTransition(from, to), `${from}→${to} should be invalid`).toBe(false);
                }
            }
        }
    });
});
// Type exports are accessible
describe('type exports', () => {
    it('ReportStatus is exported and constructible as a literal', () => {
        const s = 'new';
        expect(s).toBe('new');
    });
    it('DispatchStatus is exported and constructible as a literal', () => {
        const s = 'accepted';
        expect(s).toBe('accepted');
    });
});
//# sourceMappingURL=state-machines.test.js.map