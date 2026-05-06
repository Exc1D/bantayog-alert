import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      {
        find: /^@bantayog\/shared-ui/,
        replacement: path.resolve(__dirname, '../../packages/shared-ui/src/index.ts'),
      },
      {
        find: /^@bantayog\/shared-types/,
        replacement: path.resolve(__dirname, '../../packages/shared-types/src/index.ts'),
      },
      {
        find: /^@bantayog\/shared-validators/,
        replacement: path.resolve(__dirname, '../../packages/shared-validators/src/index.ts'),
      },
    ],
  },
  test: {
    globals: true,
    environment: 'happy-dom',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    setupFiles: ['./src/vitest.setup.ts'],
  },
})
