# Deployment Rollback Runbook

## When to Use This Runbook

This runbook covers reverting a bad deploy or undoing accidental data mutation to the **staging** or **production** Firebase project. It assumes you have `firebase-cli` installed, are logged in (`firebase login`), and have `GOOGLE_APPLICATION_CREDENTIALS` or ADC set.

## Before You Act

1. **Stop.** Do not panic-deploy a fix on top of the bad deploy. Roll back first, investigate second.
2. **Identify the blast radius:** What was deployed (Functions, Hosting, Rules, Indexes)? What data mutated?
3. **Notify the team:** Post in the incident channel with affected project (`staging` / `production`) and estimated impact.
4. **Check Firebase Status:** Visit https://status.firebase.google.com/ for platform-wide outages.

## Scenario 1: Bad Functions Deploy

**Symptoms:** Cloud Functions return errors, new code crashes, behavior regressed.

```bash
# 1. List recent function deploys
firebase functions:log --limit 50 --project <project-id>

# 2. Roll back to previous version via the Firebase Console:
# https://console.firebase.google.com/project/<project-id>/functions
#   → Select function → Version history → Roll back to previous

# 3. Or redeploy from last known good branch/commit
git checkout <last-good-tag-or-branch>
firebase deploy --only functions --project <project-id>
```

**After rollback:**

- Run `pnpm proof:mvp-loop` against staging (or emulators if staging is unreachable).
- Verify `pnpm test` and `pnpm lint` pass.
- Monitor Cloud Functions error rates for 15 minutes.

## Scenario 2: Bad Hosting Deploy (Broken Frontend)

**Symptoms:** Blank pages, broken assets, critical UI errors.

```bash
# Roll back hosting to previous version
firebase hosting:clone <site-name>:live <site-name>:live --project <project-id>
# The CLI will warn; confirm the rollback target from the version list.

# Or via Console:
# https://console.firebase.google.com/project/<project-id>/hosting
#   → Release history → Roll back to previous release
```

**After rollback:**

- Clear CDN cache by redeploying the same version (Firebase Hosting caches aggressively).
- Smoke-test all three app entry points.

## Scenario 3: Bad Firestore Security Rules

**Symptoms:** Authentication failures, access denied, data leaks, or unauthorized writes.

```bash
# Firestore rules version history is in Console only:
# https://console.firebase.google.com/project/<project-id>/firestore/rules
#   → Rules → Version history → Roll back to previous version
```

**Warning:** Rules rollbacks are immediate and global. Coordinate with the team before applying.

**After rollback:**

- Run `pnpm test:rules` against emulators to confirm the old rules are still valid.
- Verify no test suites are broken.

## Scenario 4: Bad Realtime Database Rules

**Symptoms:** RTDB reads fail, writes blocked, data not syncing.

**Note:** Realtime Database rules are separate from Firestore rules and indexes. Do not confuse RTDB with Firestore.

```bash
# Console → Realtime Database → Rules → Version history → Roll back to previous version
# No CLI option for RTDB rules rollback; must use the Firebase Console.
```

**After rollback:**

- Re-run `pnpm test:rules` to verify RTDB rule tests still pass.
- Check that RTDB client listeners reconnect without permission errors.

## Scenario 5: Bad Firestore Index

**Symptoms:** Queries return `FAILED_PRECONDITION`, performance degrades, or new compound queries fail despite correct rules.

**Note:** Firestore composite indexes are separate from RTDB rules. This is an index issue, not a rules issue.

```bash
# Console → Firestore Database → Indexes → Composite indexes → delete the incorrect index
#   Note: index deletion is async; wait 5-10 minutes before retesting queries.
#   There is no version history for Firestore indexes; you must re-create them manually.
```

**After rollback:**

- Re-run the query that was failing to confirm it now executes without `FAILED_PRECONDITION`.
- Run `pnpm test:rules` to ensure no rule regressions.

## Scenario 6: Accidental Broad Data Mutation

**Symptoms:** Too many documents deleted, incorrect bulk update, corrupted demo data.

### If seed/reset was run against the wrong project:

```bash
# staging-seed.ts and staging-reset.ts refuse to run against production,
# but if mutation happened manually or via another script:

# 1. Check what project is active
firebase projects:list

# 2. If production was hit, assess the damage
firebase firestore:documents:get path/to/document --project bantayog-alert

# 3. There is no automated restore from Firestore without scheduled backups.
# Ensure Cloud Firestore backups are configured in the project:
# https://console.firebase.google.com/project/<project-id>/firestore/backups
```

### If documents were deleted:

- Firestore does **not** have automatic point-in-time recovery unless Cloud Firestore Datastore Admin backups are enabled.
- If backups exist, restore from the most recent backup via the GCP Console.
- If no backups exist, reconstruct from `report_events`/`dispatch_events` audit trails.

## Scenario 7: Malicious Report Flood (Abuse)

**Symptoms:** Sudden spike in report submissions, irrelevant or spam data.

1. **Do not delete yet** — preserve evidence.
2. Identify the source (check `reports.createdBy` and IP/App Check tokens in Cloud Functions logs).
3. Rate-limit or block at the App Check level if the attacker is using a stolen token.
4. Mark reports as `rejected` with reason `obviously_false` via the Admin Desktop.
5. Create a moderation incident document in `report_private/moderationIncidents`.
6. Export offending UIDs for review with the LGU data privacy officer.

## Rollback Prevention Checklist

Before any deploy to staging or production, verify:

- [ ] `pnpm test` passes locally.
- [ ] `pnpm proof:mvp-loop` passes (or `pnpm proof:local` for browser proof).
- [ ] `pnpm lint` is clean.
- [ ] Branch name is not `main` (deploys should come from release tags or deployment branches).
- [ ] The target project is correct (`--project bantayog-alert-staging` or `bantayog-alert`).
- [ ] The rollback tag exists (`git tag deploy-<date>` on last known good commit).
- [ ] Team has been notified of the deploy window.

## Emergency Contacts

| Role                 | Escalation                                |
| -------------------- | ----------------------------------------- |
| Primary on-call      | See `#incidents` Slack / Telegram channel |
| Firebase support     | https://firebase.google.com/support       |
| LGU point-of-contact | Documented in LGU pilot agreement         |

## Related Runbooks

- [Pilot Demo Runbook](./pilot-demo.md) — Local setup and demo procedures.
- [Incident Response Runbook](./incident-response.md) — System failure during demos/pilots.
- [Data Privacy Runbook](./data-privacy.md) — PII locations, retention, and erasure procedures.
