import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Vendor chunks - librerías de terceros
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-firebase': ['firebase/app', 'firebase/auth', 'firebase/firestore', 'firebase/functions'],
          'vendor-charts': ['recharts'],
          'vendor-ui': ['lucide-react', '@tanstack/react-query', 'zustand'],
        }
      }
    },
    chunkSizeWarningLimit: 600, // Aumentar límite de warning
  }
})
