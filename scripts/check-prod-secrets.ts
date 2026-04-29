#!/usr/bin/env tsx
/**
 * Pre-flight check: verify all required secrets exist and are non-empty in Secret Manager.
 * Run before terraform apply on a new environment.
 *
 * Usage: npx tsx scripts/check-prod-secrets.ts [project-id]
 * Default project: bantayog-alert
 * Requires: gcloud CLI authenticated with roles/secretmanager.secretAccessor
 */
import { spawnSync } from 'node:child_process'

const project = process.argv[2] ?? 'bantayog-alert'

const REQUIRED_SECRETS = [
  'SEMAPHORE_API_KEY',
  'GLOBE_LABS_APP_ID',
  'GLOBE_LABS_APP_SECRET',
  'GLOBE_LABS_SHORT_CODE',
  'FIREBASE_WEB_API_KEY',
  'BREAK_GLASS_CODE_A',
  'BREAK_GLASS_CODE_B',
]

const missing: string[] = []

console.log(`Checking ${REQUIRED_SECRETS.length} secrets in project ${project}...\n`)

for (const name of REQUIRED_SECRETS) {
  const result = spawnSync(
    'gcloud',
    ['secrets', 'versions', 'access', 'latest', '--secret', name, '--project', project],
    { encoding: 'utf8' },
  )

  if (result.status !== 0 || result.error) {
    const reason = result.error
      ? `gcloud error: ${result.error.message}`
      : `exit code ${result.status}`
    console.error(`x ${name} — MISSING OR INACCESSIBLE (${reason})`)
    missing.push(name)
    continue
  }

  const value = result.stdout.trim()
  if (!value) {
    console.error(`x ${name} — EMPTY`)
    missing.push(name)
  } else {
    console.log(`ok ${name}`)
  }
}

if (missing.length > 0) {
  console.error(
    `\n${missing.length} secret(s) missing in ${project}. Populate them before running terraform apply.`,
  )
  process.exit(1)
}

console.log(`\nAll ${REQUIRED_SECRETS.length} secrets verified in ${project}.`)
