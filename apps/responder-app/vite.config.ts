import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: { port: 5174 },
  build: { outDir: 'dist', sourcemap: true },
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version ?? '0.0.0'),
    // Expose firebase config env vars to the service worker scope.
    // The SW file reads import.meta.env.VITE_FIREBASE_* directly.
  },
  // Service worker is in /public — Vite copies it to /dist as-is.
})
