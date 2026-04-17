import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing'

const FIRESTORE_RULES_PATH = resolve(process.cwd(), '../infra/firebase/firestore.rules')
const RTDB_RULES_PATH = resolve(process.cwd(), '../infra/firebase/database.rules.json')
const STORAGE_RULES_PATH = resolve(process.cwd(), '../infra/firebase/storage.rules')

export async function createTestEnv(projectId: string): Promise<RulesTestEnvironment> {
  return initializeTestEnvironment({
    projectId,
    firestore: {
      rules: readFileSync(FIRESTORE_RULES_PATH, 'utf8'),
    },
    database: {
      rules: readFileSync(RTDB_RULES_PATH, 'utf8'),
    },
    storage: {
      rules: readFileSync(STORAGE_RULES_PATH, 'utf8'),
    },
  })
}

export function authed(env: RulesTestEnvironment, uid: string, claims: Record<string, unknown>) {
  return env.authenticatedContext(uid, claims).firestore() as unknown as ReturnType<
    RulesTestEnvironment['authenticatedContext']
  >['firestore']
}

export function unauthed(env: RulesTestEnvironment) {
  return env.unauthenticatedContext().firestore() as unknown as ReturnType<
    RulesTestEnvironment['unauthenticatedContext']
  >['firestore']
}
