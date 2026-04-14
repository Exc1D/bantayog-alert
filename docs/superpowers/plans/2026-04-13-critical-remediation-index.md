# Critical Audit Remediation Plan Index

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Break the six critical findings from `docs/audit/2026-04-13/01-critical.md` into focused, executable implementation plans.

**Architecture:** The critical findings fall into four independent tracks: report submission/storage, profile routing/account UX, privacy retention/deletion consistency, and Firebase rules/deployment integrity. Each track is isolated enough to execute and validate separately.

**Tech Stack:** React, TypeScript, Firebase Auth, Firestore, Cloud Functions, Firebase Storage, Vitest

---

## Plans

- `docs/superpowers/plans/2026-04-13-critical-report-persistence-storage.md`
  Fixes the broken online report submission path and the Storage-rule blocker for queued photo uploads.

- `docs/superpowers/plans/2026-04-13-critical-profile-routing-account-flows.md`
  Fixes unreachable registered-user profile flows and the missing authenticated profile route behavior.

- `docs/superpowers/plans/2026-04-13-critical-privacy-retention-consistency.md`
  Fixes account deletion, retention/archive drift, and makes the legal-compliance path coherent.

- `docs/superpowers/plans/2026-04-13-critical-firebase-rules-deployment-integrity.md`
  Fixes broken Firebase project configuration around the missing `auth.rules` reference and adds deployment/test guardrails.

## Execution Order

1. Report persistence + storage
2. Profile routing + authenticated UX
3. Privacy retention + deletion consistency
4. Firebase rules + deployment integrity

## Why This Split

- Report persistence and Storage rules are release-blocking for the primary citizen flow.
- Profile routing is user-facing but mostly isolated from backend retention logic.
- Privacy retention touches client deletion code, Cloud Functions, and rules; it deserves a dedicated pass.
- Firebase config/rules integrity is partly an infrastructure decision and should be validated after the application paths are aligned.

