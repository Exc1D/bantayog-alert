import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    include: [
      'packages/shared-validators/src/**/*.test.ts',
      'packages/shared-firebase/src/**/*.test.ts',
    ],
    exclude: ['functions/**', 'apps/citizen-pwa/**', '**/node_modules/**'],
  },
})
