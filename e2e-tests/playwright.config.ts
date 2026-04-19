import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './specs',
  timeout: 120_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],

  use: {
    baseURL: process.env.BASE_URL ?? 'http://localhost:5173',
    trace: 'on-first-retry',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: process.env.CI
    ? undefined
    : [
        {
          command: 'pnpm --filter @bantayog/citizen-pwa dev',
          url: 'http://localhost:5173',
          timeout: 120_000,
          reuseExistingServer: true,
        },
        {
          command: 'pnpm --filter @bantayog/responder-app dev',
          url: 'http://localhost:5174',
          timeout: 120_000,
          reuseExistingServer: true,
        },
        {
          command: 'pnpm --filter @bantayog/admin-desktop dev',
          url: 'http://localhost:5175',
          timeout: 120_000,
          reuseExistingServer: true,
        },
      ],
})
