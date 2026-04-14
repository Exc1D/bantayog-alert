## Dependency Audit (captured 2026-04-13)

This file summarizes `npm audit --json` captured on 2026-04-13.

### Summary

- Total vulnerabilities: 21
- High: 6
- Moderate: 2
- Low: 13
- Critical: 0

### High / Moderate (actionable)

- `firebase-tools` (direct) high severity via `tar` path traversal advisories; fix available suggests upgrading `firebase-tools` to `15.14.0` (semver-major jump vs current `13.32.0` in `package.json:69`).
- `vite` (direct) moderate severity (path traversal / dev server request leakage via `esbuild`); fix available suggests upgrading `vite` to `8.0.8` (semver-major jump vs `package.json:79`).
- `vite-plugin-pwa` (direct) reported high severity via `workbox-build` -> `@rollup/plugin-terser` -> `serialize-javascript`; fix available suggests upgrading `vite-plugin-pwa` (audit indicated a semver-major change).

### Notes

- Several advisories are dev-tooling scoped (Vite dev server, Firebase CLI tooling). Even so, treat as high priority if developers run the toolchain on shared networks or ingest untrusted archives.
- Re-run `npm audit` after upgrades; the dependency graph changes can add/remove findings.

