import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'care.carcareconnect.app',
  appName: 'Car Care Connect',
  webDir: 'dist',
  server: {
    url: 'https://carcareconnect.care',
    cleartext: true
  },
  android: {
    allowMixedContent: true,
    backgroundColor: '#ffffff'
  }
};

export default config;
