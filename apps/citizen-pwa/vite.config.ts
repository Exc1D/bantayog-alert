import { defineConfig, loadEnv } from 'vite'
import { assertNoEmulatorInProduction } from '@bantayog/shared-build-utils'
import react from '@vitejs/plugin-react'

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  const rawEmulator = process.env.VITE_USE_EMULATOR ?? env.VITE_USE_EMULATOR
  assertNoEmulatorInProduction(command, mode, rawEmulator, 'citizen')

  return {
    plugins: [react()],
    server: { port: 5173 },
    build: {
      outDir: 'dist',
      sourcemap: true,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules')) {
              if (id.includes('firebase')) return 'firebase'
              if (id.includes('leaflet') || id.includes('react-leaflet')) return 'map'
              if (id.includes('framer-motion')) return 'animation'
              if (id.includes('lucide-react')) return 'icons'
              if (id.includes('react') || id.includes('react-dom') || id.includes('react-router'))
                return 'react-vendor'
              return 'vendor'
            }
          },
        },
      },
    },
    define: {
      __APP_VERSION__: JSON.stringify(process.env.npm_package_version ?? '0.0.0'),
    },
  }
})
