import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
export default defineConfig({
  plugins: [react()],
  build: {
    sourcemap: true,
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          supabase: ['@supabase/supabase-js'],
          ui: ['react-hot-toast'],
          capacitor: ['@capacitor/core', '@capacitor/filesystem', '@capacitor/browser'],
          sentry: ['@sentry/react'],
        }
      }
    }
  }
})
