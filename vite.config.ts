import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],

  // chk5.PERF-VITE (2026-05-29) · Solución integral a la lentitud de "primera carga"
  // de cada módulo en DEV. Causa raíz: Vite descubría y pre-empaquetaba las deps
  // pesadas ON-DEMAND la primera vez que un módulo las importaba → re-bundle +
  // recarga ("se queda cargando"). Especialmente grave con lucide-react (cada ícono
  // se servía como request HTTP separado · cientos por módulo) y firebase.
  // optimizeDeps.include las pre-empaqueta AL ARRANCAR · una sola vez · y todas las
  // navegaciones posteriores quedan instantáneas. NO afecta el build de producción.
  optimizeDeps: {
    include: [
      // Core (todos los módulos)
      'react',
      'react-dom',
      'react-dom/client',
      'react-router-dom',
      'zustand',
      // Firebase (todos los módulos · listeners + auth)
      'firebase/app',
      'firebase/auth',
      'firebase/firestore',
      'firebase/functions',
      'firebase/storage',
      // UI transversal
      'lucide-react', // ← crítico: sin esto cada ícono = 1 request en dev
      'clsx',
      'tailwind-merge',
      // Charts (dashboards · contabilidad · ventas · inversionistas)
      'recharts',
      // Fechas (transversal)
      'date-fns',
      // Forms (todos los wizards/modales)
      'react-hook-form',
      '@hookform/resolvers',
      '@hookform/resolvers/zod',
      'zod',
      // Exports (comunes: CSV/XLSX/PDF)
      'xlsx',
      'jspdf',
      'jspdf-autotable',
    ],
  },

  // server.warmup · pre-transforma los archivos que TODOS los módulos comparten
  // al arrancar el dev server, en background, para que la primera navegación
  // no pague el costo de transform en caliente.
  server: {
    warmup: {
      clientFiles: [
        './src/main.tsx',
        './src/App.tsx',
        './src/lib/firebase.ts',
        './src/components/layout/MainLayout.tsx',
        './src/components/layout/Sidebar.tsx',
        './src/store/authStore.ts',
      ],
    },
  },

  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Vendor chunks - librerías de terceros
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-firebase': ['firebase/app', 'firebase/auth', 'firebase/firestore', 'firebase/functions'],
          'vendor-charts': ['recharts'],
          'vendor-ui': ['lucide-react', 'zustand'],
        }
      }
    },
    chunkSizeWarningLimit: 600, // Aumentar límite de warning
  }
})
