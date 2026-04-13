import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: [
      'src/**/__tests__/**/*.{test,spec}.{ts,tsx}',
      'src/test/**/*.test.{ts,tsx}',
      'tests/unit/**/*.test.ts',
    ],
    exclude: [
      '.worktrees/**',
      'node_modules/**',
      'functions/**',
      'tests/e2e/**',
      'tests/a11y/**',
      'tests/performance/**',
      'tests/integration/**',
      'tests/firestore/**',
      'src/shared/services/auth.service.test.ts',
      'src/shared/services/firestore.service.test.ts',
      'src/domains/citizen/services/auth.service.test.ts',
      'src/domains/provincial-superadmin/services/auth.service.test.ts',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'tests/',
        '**/*.test.{ts,tsx}',
        '**/*.config.{ts,js}',
        'src/main.tsx',
      ],
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 65,
        statements: 70,
        perFile: true,
      },
    },
    typecheck: {
      tsconfig: './tsconfig.json',
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@/domains': path.resolve(__dirname, './src/domains'),
      '@/shared': path.resolve(__dirname, './src/shared'),
      '@/app': path.resolve(__dirname, './src/app'),
    },
  },
})
