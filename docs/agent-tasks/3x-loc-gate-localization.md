# 3X-LOC — GATE DOC: Filipino / Bikol Localization

**Priority:** P2 — **decision gate, blocked on pilot-LGU confirmation. Do not
execute.**

**The gap:** All three apps are English-only. For a Daet, Camarines Norte
pilot serving the general public, Filipino (and optionally Bikol) UI is
likely required for real citizen adoption — flagged in the original Phase 3
goal as "decision gate, confirm with pilot LGU, likely required."

## Why it is gated

- **Scope is repo-wide**, not a ≤3-file slice: every user-facing string in
  citizen-pwa (highest priority), plus notification copy from the 3A backbone,
  plus responder/admin surfaces (lower priority — staff may work in English).
- **The decision owner is the pilot LGU**, not this repo: which language(s),
  which surfaces, who validates translations (disaster terminology must be
  reviewed by the LGU/BFP, not machine-translated).
- Starting an i18n framework before that answer risks building the wrong
  thing (Filipino-only vs Filipino+Bikol vs English-with-Filipino-citizen-app).

## Questions for the pilot LGU (carry into the pilot package, Phase 5)

1. Citizen-facing language(s): Filipino? Bikol-Daet? Both?
2. Are admin/responder staff surfaces fine in English for the pilot?
3. Who reviews translated emergency terminology and notification copy?

## When unblocked

Write execution slices: i18n framework choice + extraction for citizen-pwa
first, push-notification copy (3A strings) in the same pass, staff apps as a
follow-up decision. Until then, new UI copy should stay simple and
translation-friendly (short sentences, no idioms).
