import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.nathandavie.fitnesstracker',
  appName: 'FitnessTracker',
  // webDir is required by Capacitor CLI but unused at runtime when server.url is set
  webDir: 'out',
  server: {
    // Remote URL: the WebView loads the live Vercel deployment.
    // This means no static export needed — SSR, server components, and API routes
    // all work exactly as they do in the browser.
    url: 'https://fit.nathandavie.com',
    cleartext: false,
    // Allows the WebView to handle the custom URL scheme for deep links
    androidScheme: 'com.nathandavie.fitnesstracker',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      launchAutoHide: true,
      backgroundColor: '#0f172a',   // matches app dark background
      androidSplashResourceName: 'splash',
      showSpinner: false,
    },
    StatusBar: {
      style: 'dark',                // light text on dark status bar
      backgroundColor: '#0f172a',
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
};

export default config;
