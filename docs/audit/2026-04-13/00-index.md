## Audit Index (2026-04-13)

### Summary

- Total issues: 25
- Estimated completeness: 58%
- Biggest single risk: the citizen reporting flow appears to succeed in the UI but does not reliably persist data end-to-end.
- Recommended first fix: make `/report` actually persist submissions, then fix Storage rules/offline sync and wire the registered profile flow to the fields that are actually written.

### Severity Buckets

- Critical: `01-critical.md`
- High: `02-high.md`
- Medium: `03-medium.md`
- Low: `04-low.md`

### Supporting Inventories

- Stubs/TODO/placeholders: `05-stubs-todos-placeholders.md`
- Type-safety holes: `06-type-safety-holes.md`
- Config/env fragility: `07-config-env-fragility.md`
- Dependency risk (`npm audit`): `08-dependency-audit.md`
- Dead code notes: `09-dead-code-notes.md`

