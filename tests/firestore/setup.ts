import { initializeTestEnvironment, RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const RULES_PATH = resolve(__dirname, '../../infra/firebase/firestore.rules')

// Each test file gets its own testEnv via beforeAll and is responsible for cleanup.
// We intentionally do NOT cache a module-level singleton here because vitest runs
// all test files in the same process and afterAll ordering between describe blocks
// is unpredictable, which caused "RulesTestEnvironment has already been cleaned up" errors.
export async function getTestEnv(): Promise<RulesTestEnvironment> {
  return initializeTestEnvironment({
    projectId: 'bantayog-test',
    firestore: {
      rules: readFileSync(RULES_PATH, 'utf8'),
      host: '127.0.0.1',
      port: 8080,
    },
  })
}
