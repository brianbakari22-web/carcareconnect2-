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
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 0,
      launchAutoHide: true,
      backgroundColor: "#ffffff",
      showSpinner: false,
      splashFullScreen: false,
      splashImmersive: false,
    }
  }
};

export default config;
