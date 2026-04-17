import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'ph.gov.camnorte.bantayog.responder',
  appName: 'Bantayog Responder',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
}

export default config
