import { initializeTestEnvironment, RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const RULES_PATH = resolve(__dirname, '../../infra/firebase/firestore.rules')

let testEnv: RulesTestEnvironment | undefined

export async function getTestEnv(): Promise<RulesTestEnvironment> {
  if (!testEnv) {
    testEnv = await initializeTestEnvironment({
      projectId: 'bantayog-test',
      firestore: {
        rules: readFileSync(RULES_PATH, 'utf8'),
        host: '127.0.0.1',
        port: 8080,
      },
    })
  }
  return testEnv
}

export async function cleanupTestEnv(): Promise<void> {
  if (testEnv) {
    await testEnv.cleanup()
    testEnv = undefined
  }
}
