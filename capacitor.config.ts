import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.almalibre.franquicias',
  appName: 'Almalibre Franquicias',
  webDir: 'dist',
  server: {
    url: 'https://4afffd78-9c74-45be-a863-e5bffd6b80ac.lovableproject.com?forceHideBadge=true',
    cleartext: true
  }
};

export default config;
