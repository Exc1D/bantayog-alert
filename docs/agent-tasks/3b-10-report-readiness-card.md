# 3B-10 — Report Readiness Card (Ethical Completeness Hint)

**Priority:** P2 (the wizard already submits valid reports; this improves
triage quality, it does not unblock the loop)

**Goal:** The review step shows a small factual readiness card derived from
the draft: what is included, what is missing, and the practical consequence
("Without location, responders may not know where to verify the incident").
The stake is real — an incomplete report is harder to verify — never a
score, grade, streak, or guilt mechanic.

## Files (≤3)

- `apps/citizen-pwa/src/components/SubmitReportForm/Step3Review.tsx` (render
  the card above the existing review summary)
- a new pure `report-readiness.ts` helper next to the form (input: draft
  fields; output: `{ level: 'good' | 'needs-attention', lines: string[] }`)
- one test file for the helper (the pure function carries the logic; the
  Step3Review render assertion can live in its existing test if one exists,
  else in the helper test via a focused render)

## Design constraints

- Derive only from fields the wizard already collects (1A set): incident
  type, location/municipality/barangay, description, people injured/trapped,
  photo. No new form fields, no new validation rules — submission stays
  possible exactly as today; the card informs, it never blocks.
- Copy register per learnings.md ethics line ("situational awareness and
  lifecycle competence, not … pressure to submit"):
  - Good: "Your incident type and location are included. Adding a short
    description may help responders verify faster."
  - Missing location: "Without location, responders may not know where to
    verify the incident. Add location or describe the nearest landmark."
  - Photo line must keep the existing safety framing: "Add a photo only if
    it is safe to do so."
- Forbidden framings (reject in review): percentages, scores, "power
  level", badges, congratulatory copy, anything implying the citizen failed.
- Keep the existing hotline disclaimer in Step3Review untouched.

## Red-first test

Helper test: a draft with type+location but no description returns
`level: 'good'` with the description suggestion line; a draft without
location returns `needs-attention` with the location consequence line. Must
fail before the helper exists.

## Out of scope

- New wizard steps or fields, changes to validators/callable payloads,
  severity derivation changes, status hero (3B-09), backend changes.

## Verification

- `pnpm --dir apps/citizen-pwa exec vitest run src/components/SubmitReportForm`
- `pnpm --dir apps/citizen-pwa exec tsc --noEmit && pnpm --dir apps/citizen-pwa exec eslint src`
