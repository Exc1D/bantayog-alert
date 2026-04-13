import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['fake-indexeddb/auto'],
    include: [
      'tests/integration/**/*.test.ts',
      'tests/firestore/**/*.test.ts',
    ],
    exclude: ['.worktrees/**'],
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
