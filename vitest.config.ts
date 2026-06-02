import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    include: [
      'packages/shared-types/src/**/*.test.ts',
      'packages/shared-validators/src/**/*.test.ts',
      'packages/shared-firebase/src/**/*.test.ts',
      'e2e-tests/fixtures/**/*.test.ts',
      'scripts/*.test.ts',
    ],
    exclude: ['functions/**', 'apps/citizen-pwa/**', '**/node_modules/**'],
  },
})
