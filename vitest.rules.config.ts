import { defineConfig } from 'vitest/config'

// Config SEPARADA para los tests de firestore.rules (corren contra el emulador Firestore · entorno node).
// NO comparte el setup jsdom de la app. Se ejecuta vía `npm run test:rules` (que arranca el emulador).
export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['tests/**/*.rules.test.ts'],
    testTimeout: 15000,
    hookTimeout: 30000,
    fileParallelism: false, // las suites comparten el emulador · serializar evita choques de clearFirestore
  },
})
