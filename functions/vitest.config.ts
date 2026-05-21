import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: [
      'src/__tests__/**/*.test.ts',
      'src/domains/**/__tests__/**/*.test.ts',
      'scripts/**/*.test.ts',
    ],
    hookTimeout: 30000,
    testTimeout: 30000,
    env: {
      // Prevents module-level crashes when tests import modules that call
      // getDatabase() from firebase-admin/database without a real DB URL.
      FIREBASE_DATABASE_EMULATOR_HOST: '127.0.0.1:9000',
      // Routes Admin SDK Firestore to the emulator so adversarial-audit and
      // other integration tests don't require real application credentials.
      FIRESTORE_EMULATOR_HOST: '127.0.0.1:8081',
    },
  },
})
