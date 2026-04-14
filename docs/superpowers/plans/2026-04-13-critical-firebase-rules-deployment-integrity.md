# Critical Firebase Rules And Deployment Integrity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the broken Firebase project configuration around the missing `auth.rules` file, ensure the repo’s rules files are deployable, and add validation so config drift is caught before release.

**Architecture:** Treat `firebase.json` as the deploy contract. Validate which products are actually configured in this repo, then either remove unsupported config or add the missing rules artifact. Add a cheap validation check in tests or scripts so missing rules files cannot slip through again.

**Tech Stack:** Firebase CLI config, Firestore rules, Storage rules, shell validation, Vitest

---

## Recon Summary

- `firebase.json:7` references `auth.rules`, but the file does not exist.
- `firestore.rules` and `storage.rules` do exist.
- The repo already has emulator/rules coverage for Firestore in `tests/firestore/firestore.rules.test.ts`.
- Current external Firebase doc verification is pending network approval; this plan therefore includes an explicit “validate config contract” task before code changes are finalized.

## File Structure

**Modify:**
- `firebase.json`
- `package.json`
- `tests/firestore/firestore.rules.test.ts`
- `scripts/verify-tests.sh`

**Create:**
- `scripts/validate-firebase-config.sh`
- `auth.rules` only if the validation task proves the `auth` block is required and supported

---

### Task 1: Validate The Intended Firebase Config Contract

**Files:**
- Review: `firebase.json`
- Review: `README.md`
- Review: current Firebase CLI/docs outside the repo if approval is granted

- [ ] **Step 1: Record the decision criteria**

```text
If this project does not actively use Firebase Auth blocking functions / custom auth rules files,
remove the `auth` block from `firebase.json`.

If current Firebase CLI guidance confirms the `auth.rules` entry is required for a configured Auth product,
create `auth.rules` and commit it with explicit intent.
```

- [ ] **Step 2: Validate local config references**

Run: `rg -n "auth.rules|\"auth\"" firebase.json README.md docs functions`

Expected: Only the real deploy contract references remain visible.

- [ ] **Step 3: Capture the decision in the implementation PR description**

```text
- Decision: remove `firebase.json.auth` block OR add `auth.rules`
- Reason: match current Firebase CLI support and actual repo usage
```

---

### Task 2: Add A Firebase Config Validation Script

**Files:**
- Create: `scripts/validate-firebase-config.sh`
- Modify: `package.json`

- [ ] **Step 1: Write the validation script**

```bash
#!/usr/bin/env bash
set -euo pipefail

test -f firebase.json
test -f firestore.rules
test -f storage.rules

if rg -q '"auth"' firebase.json; then
  test -f auth.rules
fi
```

- [ ] **Step 2: Wire it into package scripts**

```json
{
  "scripts": {
    "validate:firebase-config": "bash scripts/validate-firebase-config.sh"
  }
}
```

- [ ] **Step 3: Run the validator before making the final config decision**

Run: `npm run validate:firebase-config`

Expected: FAIL under the current repo state, proving the drift is real.

---

### Task 3: Fix The Broken `firebase.json` Contract

**Files:**
- Modify: `firebase.json`
- Optionally create: `auth.rules`

- [ ] **Step 1: Apply the smaller correct fix**

Preferred change if Auth rules are not actually required:

```json
{
  "firestore": {
    "rules": "firestore.rules",
    "indexes": "firestore.indexes.json"
  },
  "storage": {
    "rules": "storage.rules"
  }
}
```

Alternative only if validation proves the block is required:

```text
Create `auth.rules` with the minimal supported rule set for the configured Auth product.
```

- [ ] **Step 2: Re-run the validator**

Run: `npm run validate:firebase-config`

Expected: PASS

---

### Task 4: Add A Cheap Regression Check

**Files:**
- Modify: `scripts/verify-tests.sh`
- Review: `tests/firestore/firestore.rules.test.ts`

- [ ] **Step 1: Add config validation to the verification script**

```bash
npm run validate:firebase-config
```

- [ ] **Step 2: Keep Firestore rules coverage in the release path**

Run: `npm run test:rules`

Expected: PASS, confirming the repo still has working Firestore rule coverage after config cleanup.

- [ ] **Step 3: Run the final targeted validation slice**

Run: `npm run validate:firebase-config && npm run test:rules`

Expected: PASS

