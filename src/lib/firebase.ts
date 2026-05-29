import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import {
  initializeFirestore,
  getFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  connectFirestoreEmulator,
  type Firestore,
} from 'firebase/firestore';
import { getStorage, connectStorageEmulator } from 'firebase/storage';

// Firebase configuration
// IMPORTANTE: Reemplaza estos valores con tus credenciales de Firebase
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "YOUR_API_KEY",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "YOUR_AUTH_DOMAIN",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "YOUR_PROJECT_ID",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "YOUR_STORAGE_BUCKET",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "YOUR_MESSAGING_SENDER_ID",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "YOUR_APP_ID"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
export const auth = getAuth(app);
// chk5.PERF-FIRESTORE-CACHE (2026-05-29) · Persistencia local IndexedDB.
// Causa raíz TRANSVERSAL de la lentitud de carga (diagnóstico medido en sesión):
// con getFirestore() sin cache, CADA query en CADA visita a cada módulo era un
// round-trip a la nube (~150-300ms × N queries desde Perú · ~3.5s async/módulo
// medido). Con persistentLocalCache, los listeners onSnapshot entregan la data
// cacheada al INSTANTE y sincronizan en background → re-visitas instantáneas en
// TODO el sistema, sin reescribir ningún service (solución integral · un punto).
// persistentMultipleTabManager habilita uso multi-pestaña seguro (varias
// pestañas del ERP abiertas a la vez · evita el error de single-tab lock).
//
// Idempotencia obligatoria: initializeFirestore() (a diferencia de getFirestore)
// lanza si se vuelve a llamar · y en dev Vite re-ejecuta este módulo en cada HMR.
// El try/catch garantiza: primer run inicializa con cache · re-runs reusan la
// instancia ya creada (sino la app caería al ErrorBoundary tras cada edición).
let _db: Firestore;
try {
  _db = initializeFirestore(app, {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager(),
    }),
  });
} catch {
  // Ya inicializado (HMR re-ejecutó el módulo) · reutilizar la instancia viva.
  _db = getFirestore(app);
}
export const db = _db;
export const storage = getStorage(app);

// =============================================
// EMULADORES LOCALES (para testing)
// Activar con: VITE_USE_EMULATORS=true en .env.local
// =============================================
const useEmulators = import.meta.env.VITE_USE_EMULATORS === 'true';

if (useEmulators) {
  console.log('🔧 Conectando a Firebase Emulators (modo testing)...');

  try {
    connectFirestoreEmulator(db, 'localhost', 8080);
    connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
    connectStorageEmulator(storage, 'localhost', 9199);

    console.log('✅ Firebase Emulators conectados:');
    console.log('   Firestore: localhost:8080');
    console.log('   Auth: localhost:9099');
    console.log('   Storage: localhost:9199');
    console.log('   UI: http://localhost:4000');
  } catch (error) {
    console.error('❌ Error conectando a emuladores:', error);
    console.warn('   Asegurate de tener los emuladores corriendo: npm run emulators');
  }
}

export default app;
