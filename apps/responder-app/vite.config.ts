import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  const rawEmulator = process.env.VITE_USE_EMULATOR ?? env.VITE_USE_EMULATOR
  const normalizedEmulator = String(rawEmulator).toLowerCase()
  const emulatorEnabled = normalizedEmulator === 'true' || normalizedEmulator === '1'

  if (command === 'build' && mode === 'production' && emulatorEnabled) {
    throw new Error(
      `Refusing production responder build with VITE_USE_EMULATOR=${String(rawEmulator)}. ` +
        'Set VITE_USE_EMULATOR=false for staging/prod Hosting builds.',
    )
  }

  return {
    plugins: [react()],
    server: { port: 5174 },
    build: {
      outDir: 'dist',
      sourcemap: true,
      rollupOptions: {
        output: {
          manualChunks(id: string) {
            if (id.includes('node_modules/leaflet') || id.includes('node_modules/react-leaflet')) {
              return 'leaflet'
            }
            if (id.includes('node_modules/firebase')) {
              return 'firebase'
            }
          },
        },
      },
    },
    define: {
      __APP_VERSION__: JSON.stringify(process.env.npm_package_version ?? '0.0.0'),
      // Expose firebase config env vars to the service worker scope.
      // The SW file reads import.meta.env.VITE_FIREBASE_* directly.
    },
    // Service worker is in /public — Vite copies it to /dist as-is.
  }
})
