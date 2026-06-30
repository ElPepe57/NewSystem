import { defineConfig, configDefaults } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    // Los tests de firestore.rules (tests/**) corren aparte vía `npm run test:rules` (emulador · entorno node).
    // `.claude/**` excluye los worktrees efímeros de agentes (.claude/worktrees/*): si no, DUPLICAN
    // y ensucian la corrida con copias stale de los .test.ts (limpieza 2026-06-30).
    exclude: [...configDefaults.exclude, 'tests/**', '.claude/**'],
  },
})
