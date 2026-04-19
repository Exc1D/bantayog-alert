import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  server: { port: 5174 },
  build: { outDir: 'dist', sourcemap: true },
  define: {
    // Expose firebase config env vars to the service worker scope.
    // The SW file reads import.meta.env.VITE_FIREBASE_* directly.
  },
  // Service worker is in /public — Vite copies it to /dist as-is.
})
