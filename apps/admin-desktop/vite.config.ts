import path from 'path'
import { defineConfig, loadEnv } from 'vite'
import { assertNoEmulatorInProduction } from '@bantayog/shared-build-utils'
import react from '@vitejs/plugin-react'

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  const rawEmulator = process.env.VITE_USE_EMULATOR ?? env.VITE_USE_EMULATOR
  assertNoEmulatorInProduction(command, mode, rawEmulator, 'admin')

  return {
    plugins: [react()],
    server: { port: 5175 },
    build: {
      outDir: 'dist',
      sourcemap: true,
      cssMinify: 'esbuild',
      minify: 'esbuild',
    },
    define: {
      __APP_VERSION__: JSON.stringify(process.env.npm_package_version ?? '0.0.0'),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
  }
})
