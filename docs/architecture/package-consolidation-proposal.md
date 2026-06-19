# Package Consolidation Proposal

RF-11 Phase 1 only. This is an evidence-backed proposal, not approval to move code.

## Scope

This proposal assumes these prerequisite refactor branches land first:

- RF-09 `1a5b5889`: deletes `@bantayog/shared-sms-parser`.
- RF-10 `38ce3487`: deletes `packages/shared-validators/src/incident-core.ts` and its exports.

Do not start Phase 2 until those decisions are present on the target branch. If either prerequisite changes, rerun the commands below.

## Evidence Commands

Run these from the repository root after RF-09 and RF-10 are applied:

```bash
fallow list --workspaces --format json --quiet
fallow list --entry-points --format json --quiet

node -e 'const fs=require("fs"),path=require("path"); const pkgs=["shared-data","shared-firebase","shared-state-machines","shared-types","shared-ui","shared-validators"]; for (const pkg of pkgs){ const dir="packages/"+pkg+"/src"; let files=[]; const walk=d=>{for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,e.name); if(e.isDirectory()) walk(p); else if(/\.(ts|tsx)$/.test(e.name)) files.push(p)}}; walk(dir); let loc=0; for(const f of files) loc += fs.readFileSync(f,"utf8").split(/\r?\n/).length; const index=path.join(dir,"index.ts"); const exportLines=fs.existsSync(index)? fs.readFileSync(index,"utf8").split(/\r?\n/).filter(l=>/^export(\s|\{)/.test(l)).length : 0; console.log(pkg+"\tfiles="+files.length+"\tloc="+loc+"\texport_lines="+exportLines); }'

node -e "const fs=require('fs'),path=require('path'); const roots=['apps','packages','functions','e2e-tests']; const targets=['@bantayog/shared-data','@bantayog/shared-firebase','@bantayog/shared-state-machines','@bantayog/shared-types','@bantayog/shared-ui','@bantayog/shared-validators']; const ws=[]; for (const root of roots){ if(!fs.existsSync(root)) continue; for(const entry of fs.readdirSync(root)){ const p=path.join(root,entry,'package.json'); if(fs.existsSync(p)) ws.push(p); } const p=path.join(root,'package.json'); if(fs.existsSync(p)) ws.push(p); } for(const pkgPath of [...new Set(ws)].sort()){ const pkg=JSON.parse(fs.readFileSync(pkgPath,'utf8')); const deps={...(pkg.dependencies||{}),...(pkg.devDependencies||{}),...(pkg.peerDependencies||{})}; const used=targets.filter(t=>deps[t]); if(used.length) console.log(pkg.name+': '+used.join(', ')); }"

for pkg in shared-data shared-firebase shared-state-machines shared-types shared-ui shared-validators; do
  echo "## @bantayog/$pkg"
  git grep -l "@bantayog/$pkg" -- ':*.ts' ':*.tsx' ':!docs/**' ':!**/lib/**' ':!node_modules/**' 2>/dev/null |
    sed -E 's#^functions/src/.*#functions#; s#^scripts/.*#scripts#; s#^([^/]+/[^/]+).*#\1#' |
    sort -u |
    tr '\n' ' '
  echo
done
```

Observed evidence in this run:

- Post-RF-09 package inventory: `shared-data`, `shared-firebase`, `shared-state-machines`, `shared-types`, `shared-ui`, `shared-validators`.
- Post-RF-10 shared-validator size: 37 source files, 3,963 LOC, 40 export-line groups.
- Workspace dependency edges: apps depend on `shared-types`, `shared-ui`, and `shared-validators`; Functions depends on `shared-types` and `shared-validators`; `shared-validators` depends on `shared-state-machines` and `shared-types`.
- Source import graph: `shared-state-machines` is imported only by `shared-validators`; `shared-firebase` is imported only by `citizen-pwa`; `shared-data` has no source importers.

## Package Recommendations

| Package                           | Evidence                                                                                                                                                                    | Recommendation                                                                        | Reason                                                                                                                                                                                |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@bantayog/shared-data`           | 1 source file, 3 LOC, 1 export, no package-dependency importers, no source importers. Source is only `sharedDataVersion`.                                                   | Delete in Phase 2.                                                                    | It is a placeholder package with ceremony but no product value.                                                                                                                       |
| `@bantayog/shared-firebase`       | 8 source files, 450 LOC, 4 export groups. Package dependency only from `citizen-pwa`; source imports only in `apps/citizen-pwa`.                                            | Keep for now; optional later merge into `citizen-pwa` only if no other app adopts it. | Single production consumer, but it encodes reusable Firebase web setup and App Check behavior. Folding it now saves one package but may force duplication when Admin/Responder align. |
| `@bantayog/shared-state-machines` | 6 source files, 309 LOC, 5 export-line groups. Only source/package consumer is `shared-validators`; `shared-validators` already re-exports transition helpers/status types. | Merge into `shared-validators` in Phase 2.                                            | It is real domain logic, but its only independent consumer is the validator package. Keeping a separate workspace adds build/lib drift without preserving an app-facing boundary.     |
| `@bantayog/shared-types`          | 11 source files, 365 LOC, 7 barrel export groups. Imported by all three apps, Functions, `shared-firebase`, `shared-state-machines`, and `shared-validators`.               | Keep.                                                                                 | It is a broad type contract package with many consumers. Any Zod-inferred-type replacement should be domain-by-domain, not a package merge.                                           |
| `@bantayog/shared-ui`             | 5 source files, 547 LOC, 3 export groups plus `theme.css`. Package deps include all three apps; source importers are Admin and Responder.                                   | Keep; remove unused app dependency separately if confirmed.                           | Shared UI has peer dependencies and real multi-app use. It is not a cleanup target unless product design decides these apps should diverge.                                           |
| `@bantayog/shared-validators`     | 37 source files, 3,963 LOC, 40 export-line groups after RF-10. Imported by all apps, Functions, and scripts.                                                                | Keep as the central runtime contract package.                                         | This is the validation and shared state-contract spine. Merging it into apps/functions would multiply boundary validation risk.                                                       |

## Phase 2 Slices

Recommended execution order:

1. `rf-11a-delete-shared-data`: remove `packages/shared-data`, lockfile/workspace entries, lint baselines, and any stale generated references. Verification: root `pnpm install --frozen-lockfile=false`, `pnpm build`, `pnpm typecheck`, `pnpm lint`, `pnpm test`, Fallow new-only audit.
2. `rf-11b-merge-state-machines-into-validators`: `git mv` state-machine source/tests under `packages/shared-validators/src/state-machines/`, keep existing `@bantayog/shared-validators` exports stable, remove `@bantayog/shared-state-machines` workspace and dependency edges. Verification: root build/typecheck/lint/test before and after, plus focused shared-validator tests with unchanged transition test counts.
3. Optional `rf-11c-citizen-shared-firebase-decision`: either keep `shared-firebase` deliberately or move it into `apps/citizen-pwa/src/firebase/` if Admin/Responder are not going to adopt it. This needs a product/platform call because App Check emulator behavior has been a durable project quirk.

Do not merge `shared-types`, `shared-ui`, or `shared-validators` as whole packages in this round.

## Guardrails

- One package move/delete per branch.
- Use `git mv` for moved code so history survives.
- Keep surviving `@bantayog/*` import specifiers stable for app/function consumers.
- Rebuild package `lib/` outputs before emulator or Functions tests that import package exports.
- No rules, indexes, schema/migration, deploy, or app topology changes in Phase 2 package cleanup branches.
