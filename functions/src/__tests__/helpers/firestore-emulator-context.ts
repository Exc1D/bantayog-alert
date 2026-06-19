import type { RulesTestEnvironment } from '@firebase/rules-unit-testing'
import type { Firestore } from 'firebase-admin/firestore'

export interface WithFirestoreRulesDisabledOptions {
  env: RulesTestEnvironment | undefined
  available: boolean
  skip: (reason: string) => void
  run: (db: Firestore, env: RulesTestEnvironment) => Promise<void>
}

export async function withFirestoreRulesDisabled({
  env,
  available,
  skip,
  run,
}: WithFirestoreRulesDisabledOptions): Promise<void> {
  if (!available || !env) {
    skip('Firestore emulator unavailable')
    return
  }

  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore() as unknown as Firestore
    await run(db, env)
  })
}
