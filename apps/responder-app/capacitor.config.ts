import type { CapacitorConfig } from '@capacitor/cli'

// Background geolocation plugin choice:
// - @capawesome/capacitor-background-geolocation does not exist on npm.
// - @capacitor/background-runner is designed for periodic background tasks
//   (30s max on iOS, 15min intervals on Android), not continuous location tracking.
// - @capacitor-community/background-geolocation is the only option that provides
//   continuous background location updates via addWatcher/removeWatcher.
//   Its peer dependency is @capacitor/core >=3.0.0, so it is compatible with v8.
const config: CapacitorConfig = {
  appId: 'ph.gov.camnorte.bantayog.responder',
  appName: 'Bantayog Responder',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
}

export default config
